function mSkyPipe(device, context, canvas){
  mSkyShader = device.createShaderModule({
    label: "main sky shader",
    code: /*wgsl*/`
    @group(0) @binding(0) var sky:texture_2d<f32>;
    @group(0) @binding(1) var skysampler:sampler;
    struct sunStruct {
      dir:vec3f, //MUST BE UNIT
      alt:f32,
      col:vec3f,
    }
    @group(0) @binding(2) var<uniform> sun:sunStruct;
    @group(0) @binding(3) var trans:texture_2d<f32>;
    @group(0) @binding(4) var transsampler:sampler;

    struct camStruct {
      pMatrix:mat4x4f,
      aInv:mat4x4f,
    }
    @group(1) @binding(0) var<uniform> cam: camStruct;

    ${wgsl.skyParams}

    override width:f32;
    override height:f32;

    ${screenVertexQuad}
    @fragment
    fn fragmentMain(
      @builtin(position) pix:vec4f,
    )->@location(0) vec4f{
      let ndc=vec4f(pix.xy*2/vec2f(width, -height)-vec2f(1,-1),1,1);
      let dir=normalize((cam.aInv*ndc).xyz);

      let theta = atan(dir.z/dir.x)+select(0,PI,dir.x<0);
      let phi = asin(dir.y);
      let skysample = textureSampleLevel(sky, skysampler, vec2f(
        theta/2/PI,
        0.5+0.5*sign(phi)*sqrt(abs(phi)*2/PI)
      ),0);

      var color = vec3f(0,0,0);
      let cheight = sun.alt+gRad;
      let hcos = cheight*dir.y;
      let ghit = -hcos-sqrt(hcos*hcos-cheight*cheight+gRad*gRad);
      if(ghit>0){
        let hitnorm = normalize(ghit*dir+vec3f(0,cheight,0));
        color+=max(dot(sun.dir,hitnorm),0)*gDiffuse;
        let halfray = normalize(sun.dir-dir);
        color+=pow(max(0,dot(halfray,hitnorm)),gSpecHard)*gSpecular;
      }
      color*=skysample.a*sun.col;

      color+=skysample.rgb;

      return vec4f(2*color,1);
    }
    `
  });

  const mSkyPipe = device.createRenderPipeline({
    label:"Deferred rendering pipe",
    layout: device.createPipelineLayout({
      label: "Deferred rendering pipe layout",
      bindGroupLayouts:[bgs.sky.bgl, bgs.cam.bgl],
    }),
    vertex: {
      module: mSkyShader,
      entryPoint: 'vertexMain'
    },
    fragment:{
      module: mSkyShader,
      entryPoint: 'fragmentMain',
      targets: [{
        format: canvasFormat,
      }],
      constants: {
        width: canvas.width,
        height: canvas.height
      }
    },
  });

  return (encoder)=>{
    const pass = encoder.beginRenderPass({
      colorAttachments:[{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        clearValue:[0,0,0.4,1],
        storeOp: "store",
      }]
    });
    pass.setPipeline(mSkyPipe);
    pass.setBindGroup(0,bgs.sky);
    pass.setBindGroup(1,bgs.cam);
    pass.draw(6);
    pass.end();
  }
}