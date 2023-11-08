function gNoise(device, code, dim, format, seed=0){
  const noiseCode = /*wgsl*/`
    @group(0) @binding(0) var tex:texture_storage_${dim.length==3? "3d":"2d"}<${format},write>;

    const seedg:u32 = ${seed};

    const PI = 3.14159265359;

    //stole this actually functional hash function thanks shadertoy
    const UI0 = 1597334673u;
    const UI1 = 3812015801u;
    const UI2 = vec2u(UI0, UI1);
    const UI3 = vec3u(UI0, UI1, 2798796415u);
    const UIF = (1.0 / f32(0xffffffffu));
    fn hash33n(p:vec3u)->vec3f{
      let q:vec3u = p*UI3;
      let q2:vec3u = (q.x^q.y^q.z)*UI3;
      return vec3f(q2)*UIF;
    }

    //important coord>0 always; t is tilable size, o is block offset

    //it would be much faster to do this properly with shared memory and
    //stuff but I don't really care about the runtime of an initializer
    fn grad3t(coord:vec3f, t:vec3u, o:vec3u)->f32{
      let coordp = modf(coord);
      let v = vec3u(coordp.whole);
      let u1 = coordp.fract;
      let u2 = u1*u1*u1*(u1*(u1*6-15)+10);

      return mix(
        mix(
          mix(
            dot(-1+2*hash33n((v+vec3u(0,0,0))%t+o),u1-vec3f(0,0,0)),
            dot(-1+2*hash33n((v+vec3u(0,0,1))%t+o),u1-vec3f(0,0,1)),
          u2.z), mix(
            dot(-1+2*hash33n((v+vec3u(0,1,0))%t+o),u1-vec3f(0,1,0)),
            dot(-1+2*hash33n((v+vec3u(0,1,1))%t+o),u1-vec3f(0,1,1)),
          u2.z),
        u2.y),mix(
          mix(
            dot(-1+2*hash33n((v+vec3u(1,0,0))%t+o),u1-vec3f(1,0,0)),
            dot(-1+2*hash33n((v+vec3u(1,0,1))%t+o),u1-vec3f(1,0,1)),
          u2.z), mix(
            dot(-1+2*hash33n((v+vec3u(1,1,0))%t+o),u1-vec3f(1,1,0)),
            dot(-1+2*hash33n((v+vec3u(1,1,1))%t+o),u1-vec3f(1,1,1)),
          u2.z),
        u2.y),
      u2.x);
    }

    //important coord>0 always; t is tilable size, o is block offset
    fn vorn3t(coord:vec3f, t:vec3u, o:vec3u)->f32{
      let coordp = modf(coord);
      let v = vec3u(coordp.whole);
      let u = coordp.fract;

      var m=2.;
      for(var i=-1; i<=1; i++){
        for(var j=-1; j<=1; j++){
          for(var k=-1; k<=1; k++){
            let tile = vec3i(i,j,k);
            m=min(m,distance(u, 
              hash33n((v+vec3u(tile))%t+o)+vec3f(tile)
            ));
          }
        }
      }
      return m;
    }

    fn vorn3tf(coord:vec3f, t:vec3u, o:vec3u)->f32{
      return vorn3t(coord+hash33n(vec3u(0,0,1)), t, o)*0.6+
        vorn3t(coord*2+hash33n(vec3u(0,0,2)), t*2, o+vec3u(0,0,1000))*0.25+
        vorn3t(coord*2+hash33n(vec3u(0,0,3)), t*2, o+vec3u(0,0,2000))*0.15;
    }

    fn grad3tf(coord:vec3f, t:vec3u, o:vec3u, octaves:u32)->f32{
      var val:f32 = 0;
      var amp:f32 = 1;
      var freq:u32 = 1u;
      for(var i:u32=0; i<octaves; i++){
        val+=amp*grad3t(
          coord*f32(freq)+hash33n(vec3u(0,0,i)), t*freq, o+vec3u(0,0,1000*i)
        );
        amp*=0.55;
        freq*=2;
      }
      return val;
    }

    fn remap(v:f32, oMin:f32, oMax:f32, nMin:f32, nMax:f32)->f32{
      return nMin+(nMax-nMin)*(v-oMin)/(oMax-oMin);
    }

    @compute
    @workgroup_size(8,8,1)
    fn main(
      @builtin(global_invocation_id) pix:vec3u,
    ){
      let c=vec3f(pix);
      let d=${(dim.length==3?'vec3u(':'vec2u(')+dim+')'};
      let df=${(dim.length==3?'vec3f(':'vec2f(')+dim+')'};
      textureStore(tex, pix, ${code});
    }
  `; 

  const tex = device.createTexture({
    label: "Noise texture",
    size: dim,
    dimension: dim.length==3? "3d":"2d",
    format: format,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
  })
  const bgl = c_bgl(device, "Noise BGL", [{r:"w", v:"cf", f:format, d:dim.length==3? 3:2}]);
  const bg = c_bg(bgl, "Noise bg", [tex.createView()]);

  const encoder = device.createCommandEncoder();
  c_vcp(device, "noisy pipe", noiseCode, "main", [bg])
    (encoder,dim[0]/8,dim[1]/8,dim[2]??1);
  device.queue.submit([encoder.finish()]);

  return tex
}