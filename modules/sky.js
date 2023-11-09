
function skyFn(device, debug=false){
  skyParams = /*wgsl*/`
    const PI=3.14159265;

    const scaleFactor = 0.000002; //10^-6
    const rScat = vec3f(5.802, 13.558, 33.1)*scaleFactor;
    const rExt = rScat;
    const mScat = 3.996*scaleFactor;
    const mAbs = 4.40*scaleFactor;
    const mExt = mScat+mAbs;
    const mAsym = 0.8; //'g'
    const oAbs = vec3f(0.650, 1.881, 0.085)*scaleFactor;
    const oExt = oAbs;

    const gRad = 300000; //6340 km
    const aWidth = 100000; //100 km
    const aRad = gRad+aWidth;

    const gDiffuse = vec3f(0.99,0.99,0.99)/PI;
    const gSpecular = vec3f(0.3,0.3,0.3);
    const gSpecHard = 400;
  `;

  //salt for sampled altitude (THIS IS THE NOMENCATURE NOW)
  const rAt = /*wgsl*/`let rAt=exp(-salt/8000);`;
  const mAt = /*wgsl*/`let mAt=exp(-salt/2000);`;
  const oAt = /*wgsl*/`let oAt=max(0, 1-abs(salt-25000)/15000);`;
  const eAt = /*wgsl*/`let eAt=rAt*rExt+mAt*mExt+oAt*oExt;`;
  wgsl.skyParams=skyParams;

  const transDim=[256,64];
  const transCode=/*wgsl*/`
    @group(0) @binding(0) var trans:texture_storage_2d<rgba16float, write>;

    const sampleCount=40f;
    ${skyParams}

    @compute
    @workgroup_size(8,8)
    fn main(
      @builtin(global_invocation_id) pix:vec3u,
    ){
      var pos = vec2f(0,1+gRad+f32(pix.y)*aWidth/${transDim[1]});
      let theta = f32(pix.x)*PI/${transDim[0]};
      let dir = vec2f(sin(theta),cos(theta));

      let hcos = pos.y*dir.y;
      let sqrtval = hcos*hcos-pos.y*pos.y; //compiler insecurity
      let dist = -hcos+sqrt(sqrtval+aRad*aRad); //circle-interior ray
      let stepsize = dist/sampleCount;
      let step = dir*stepsize/2;

      //ground zeroing (technically superflous)
      if(-hcos-sqrt(sqrtval+gRad*gRad)>0){
        textureStore(trans, pix.xy, vec4f(0,0,0,0));
        return;
      }

      var absorption = vec3f(0,0,0);
      for(var i=0f; i<sampleCount; i+=1){
        pos+=step;
        let salt = length(pos)-gRad;
        ${rAt+mAt+oAt+eAt}
        absorption+=eAt*stepsize;
        pos+=step;
      }

      textureStore(trans, pix.xy, vec4f(exp(-absorption),1));
    }
  `;

  const mscatDim = [64,32];
  const mscatCode = /*wgsl*/`
    @group(0) @binding(0) var mscat:texture_storage_2d<rgba16float, write>;
    @group(0) @binding(1) var trans:texture_2d<f32>;
    @group(0) @binding(2) var fsampler:sampler;

    const sampleRays = 64f;
    const sampleCount = 100f; //killll meeeeee
    ${skyParams}

    @compute
    @workgroup_size(${mscatDim[0]},1)
    fn main(
      @builtin(global_invocation_id) pix:vec3u
    ){
      let sunzenith = f32(pix.x)*PI/${mscatDim[0]};
      let sundir = vec3f(sin(sunzenith),cos(sunzenith),0);
      let alt = 1+f32(pix.y)*aWidth/${mscatDim[1]};

      var inscat = vec3f(0,0,0);
      var fms = vec3f(0,0,0); //only needs to be computed by alt but is virutally free
      //OPTIMIZATION TODO: replace this loop by z-depth in workgroup for stronger cards
      for(var i=0.5f; i<sampleRays; i+=1){
        //let i=f32(pix.x)+0.5;
        let phi = asin(2*i/(sampleRays)-1);
        let theta = 1.92*i;
        let dir=vec3f(
          cos(phi)*cos(theta),
          sin(phi),
          cos(phi)*sin(theta)
        );
        var pos = vec3f(0,alt+gRad,0);
        var absorption = vec3f(0,0,0);

        let hcos = pos.y*dir.y; //contrary to popular belief (coordinate space woes)
        let sqrtval = hcos*hcos-pos.y*pos.y;
        let aedge = -hcos+sqrt(sqrtval+aRad*aRad);
        let ghit = -hcos-sqrt(sqrtval+gRad*gRad);
        let dist = select(aedge,ghit,ghit>0);
        let stepsize = dist/sampleCount;
        let step = dir*stepsize/2;
        
        for(var j=0f; j<sampleCount; j+=1){
          pos+=step; //again, midpoint sampling
          let salt = length(pos)-gRad;
          ${rAt+mAt+oAt+eAt}
          absorption+=eAt*stepsize;
          let scat=(rScat*rAt+mScat*mAt)*exp(-absorption);
          let strans = textureSampleLevel(trans, fsampler, vec2f(
            acos(dot(pos,sundir)/length(pos))/PI,
            (salt-gRad)/aWidth
          ), 0).rgb;
          inscat+=scat*stepsize*strans;
          fms+=scat*stepsize;
          pos+=step;
        }
      }
      //Renormalize fms and inscat at the end
      //Remember: integration->1 so if sampled, dA negates pu
      textureStore(mscat, pix.xy, vec4f(
        inscat/(1-fms/sampleRays)/4/PI/sampleRays
      ,1));
    }
  `;

  const skyDim=[128,128];
  const skyCode = /*wgsl*/`
    @group(0) @binding(0) var sky:texture_storage_2d<rgba16float, write>;
    @group(0) @binding(1) var trans:texture_2d<f32>;
    @group(0) @binding(2) var mscat:texture_2d<f32>;
    @group(0) @binding(3) var fsampler:sampler;
    struct sunStruct {
      dir:vec3f, //MUST BE UNIT
      alt:f32,
      col:vec3f,
    }
    @group(0) @binding(4) var<uniform> sun:sunStruct;

    ${skyParams}
    //OPTIMIZATION TODO: sample better
    const sampleCount=20f;

    //OPTIMIZATION TODO: take advantage of twofold symmetry
    @compute
    @workgroup_size(8,8)
    fn main(
      @builtin(global_invocation_id) pix:vec3u
    ){
      //compiler-san, please see the constants
      let ynorm=fma(f32(pix.y),sqrt(2*PI)/${skyDim[1]},-sqrt(PI/2)); 
      let phi=ynorm*abs(ynorm);
      let theta=f32(pix.x)*2*PI/${skyDim[0]};
      let dir=vec3f(
        cos(phi)*cos(theta), 
        sin(phi), 
        cos(phi)*sin(theta)
      );
      var pos=vec3f(0,sun.alt+gRad,0);

      //phase functions (constant over ray)
      let ct=dot(dir,sun.dir);
      let cts=ct*ct;
      let rphase:f32 = fma(cts, PI*3./16., PI*3./16.); 
      const thing = (3./(8.*PI))*(1.-mAsym*mAsym)/(2.+mAsym*mAsym); //average const 
      let csdenom=pow(fma(ct, -2.*mAsym, 1.+mAsym*mAsym),3./2.);
      let mphase=fma(cts, thing, thing)/csdenom;

      let hcos = pos.y*dir.y; //lol prolly should put this in a block
      let sqrtval = hcos*hcos-pos.y*pos.y;
      let aedge = -hcos+sqrt(sqrtval+aRad*aRad);
      let ghit = -hcos-sqrt(sqrtval+gRad*gRad-gRad*aWidth/2);
      let dist = select(aedge,ghit,ghit>0);
      let stepsize = dist/sampleCount;
      let step = dir*stepsize/2;

      //VISUAL TODO:
      //Jitter and time aa
      //Shadow shi* (need to do shadows first lmao)
      var transmittance=vec3f(1,1,1);
      var light=vec3f(0,0,0);
      for(var i=0.; i<sampleCount; i+=1){
        pos+=step;
        let salt = length(pos)-gRad;
        ${rAt+mAt+oAt+eAt}
        let scoords = vec2f(
          acos(dot(pos,sun.dir)/length(pos))/PI,
          salt/aWidth
        );
        let rAc = min(rAt, 1);
        let mAc = min(mAt, 1);

        let inoutscat=(
          //first-order scattering
          textureSampleLevel(trans, fsampler, scoords, 0).rgb*
            (rScat*rAc*rphase+mScat*mAc*mphase)+
          //higher-order scattering
          textureSampleLevel(mscat, fsampler, scoords,0).rgb*
            (rScat*rAc+mScat*mAc) //phase function premultiplied
        )/eAt;
        let segtrans = exp(-stepsize*eAt);
        light += (-inoutscat*segtrans+inoutscat)*transmittance;
        transmittance *= segtrans;
        pos+=step;
      }
      textureStore(sky, pix.xy, vec4f(
        light*sun.col,
        transmittance.g
      ));
    }
  `;

  const transTex = device.createTexture({
    label: "transmittance texture",
    size: transDim,
    format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
  })
  const transBGL = c_bgl(device, "transmittance generation BGL", [{r:"w", f:"rgba16float", v:"c"}]);
  const transBG = c_bg(transBGL, "transmittance generation BG", [transTex.createView()]);

  const bbsam=device.createSampler({
    magFilter: "linear",
    minFilter: 'linear',
  });
  const mscatTex = device.createTexture({
    label: "multiple scattering texture",
    size: mscatDim,
    format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
  })
  const mscatBGL = c_bgl(device, "multiple scattering BGL", [
    {r:"w", f:"rgba16float", v:"c"}, {r:"t"}, {r:"s"}
  ]);
  const mscatBG = c_bg(mscatBGL, "multiple scattering BG", [
    mscatTex.createView(), transTex.createView(), bbsam
  ]);

  const skyUnif = device.createBuffer({
    label: "Sky Uniform",
    size: 8*4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  objs.sun = new Float32Array([
    0,0,1, //position
    30000, //altitude
    0.7,0.85,1, 0 //color
  ]);
  objs.sun.theta = Math.PI/2;
  objs.sun.gpubuf = skyUnif;
  device.queue.writeBuffer(skyUnif, 0, objs.sun);

  const skyTex=device.createTexture({
    label:"sky view texutre",
    size:skyDim,
    format: "rgba16float",
    usage:GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
  });
  const skyBGL = c_bgl(device, "sky BGL", [
    {r:"w", f:"rgba16float", v:"c"}, {r:"t"}, {r:"t"}, {r:"s"}, {r:"b"}
  ]);
  const skyBG = c_bg(skyBGL, "sky BG", [
    skyTex.createView(), transTex.createView(), mscatTex.createView(), bbsam, {buffer:skyUnif}
  ]);
  
  const encoder = device.createCommandEncoder();
  c_vcp(device, "transmittance generation pipe", transCode, "main", [transBG])
    (encoder,transDim[0]/8,transDim[1]/8);
  c_vcp(device, "multiple scattering pipe", mscatCode, "main", [mscatBG])
    (encoder,1,mscatDim[1]);
  const skyFill = c_vcp(device, "sky view pipe", skyCode, "main", [skyBG])
  skyFill(encoder,skyDim[0]/8,skyDim[1]/8);

  device.queue.submit([encoder.finish()]);
  
  let debugFn = undefined;
  if(debug){
    //vdebug4(device,[256,256],transTex)();
    vdebug4(device,[256,256],mscatTex,'vec4f(20*info)')();
    debugFn = vdebug4(device,[448,256],skyTex);
    debugFn();
  }

  bgs.sky=c_bg(c_bgl(device, "sky final bgl",[
    {r:"t"},{r:"s"},{r:"b"},{r:"t"},{r:"s"}
  ]),"final sky bg",[
    skyTex.createView(), 
    device.createSampler({
      label: "sky sampler",
      addressModeU:"repeat",
      addressModeV:"clamp-to-edge",
      magFilter: "linear",
      minFilter: 'linear',
    }),
    {buffer:skyUnif},
    transTex.createView(),
    bbsam
  ]);

  return (encoder)=>{
    skyFill(encoder, skyDim[0]/8,skyDim[1]/8);
    if(debug) debugFn(false);
  }
}

function setSunPos(device, alt, phi, theta=undefined){
  theta = theta??objs.sun.theta;
  objs.sun[0]=Math.cos(theta)*Math.cos(phi);
  objs.sun[1]=Math.sin(phi);
  objs.sun[2]=Math.sin(theta)*Math.cos(phi);
  objs.sun[3]=alt;
  device.queue.writeBuffer(objs.sun.gpubuf, 0, objs.sun);
}