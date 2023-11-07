function gNoise(device, code, dim, format, seed=0){
  const noiseCode = /*wgsl*/`
    @group(0) @binding(0) var tex:texture_storage_${dim.length==3? "3d":"2d"}<${format},write>;

    const seedg:u32 = ${seed};

    const PI = 3.14159265359;

    const primev1 = vec4u(2860486313,1500450271,3267000013,100656001);
    const prime1 = 4093082899u;
    fn hashl(a:u32, b:u32, c:u32, d:u32)->i32{
      let num = dot(primev1, vec4u(a,b,c,seedg+d));
      return i32(num%prime1) & 0xffff;
    }

    fn randUVec(seed: i32) -> vec3f {
      let u = f32(hashl(u32(seed), 0,0,0) & 0xfff)/0x8ff-1;
      let v = f32(hashl(u32(seed), 1,1,1) & 0xfff)*2*PI/0xfff;
      let m = sqrt(1-u*u);
      return vec3f(u, m*cos(v), m*sin(v));
    }

    fn fade(t:vec3f) -> vec3f{
      return t*t*t*(t*(t*6-15)+10);
    }

    fn lerp(t:f32, a:f32, b:f32) -> f32{
      return (1-t)*a+t*b;
    }

    fn perlinRep(pix:vec3u, tsize:vec3u, offset:vec3f, tile:vec3u, d:u32)->vec3f{
      let coord = modf((vec3f(pix)+offset)/vec3f(tsize));
      let lbox = vec3u(coord.whole)%tile;
      let ubox = (lbox+1)%tile;
      let ibox = fade(coord.fract);

      return vec3f(lerp(ibox.x,
        lerp(ibox.y,
          lerp(ibox.z,
            dot(randUVec(hashl(lbox.x,lbox.y,lbox.z,d)),vec3f(ibox.x,ibox.y,ibox.z)),
            dot(randUVec(hashl(lbox.x,lbox.y,ubox.z,d)),vec3f(ibox.x,ibox.y,1-ibox.z))
          ),
          lerp(ibox.z,
            dot(randUVec(hashl(lbox.x,ubox.y,lbox.z,d)),vec3f(ibox.x,1-ibox.y,ibox.z)),
            dot(randUVec(hashl(lbox.x,ubox.y,ubox.z,d)),vec3f(ibox.x,1-ibox.y,1-ibox.z))
          ),
        ),lerp(ibox.y,
          lerp(ibox.z,
            dot(randUVec(hashl(ubox.x,lbox.y,lbox.z,d)),vec3f(1-ibox.x,ibox.y,ibox.z)),
            dot(randUVec(hashl(ubox.x,lbox.y,ubox.z,d)),vec3f(1-ibox.x,ibox.y,1-ibox.z))
          ),
          lerp(ibox.z,
            dot(randUVec(hashl(ubox.x,ubox.y,lbox.z,d)),vec3f(1-ibox.x,1-ibox.y,ibox.z)),
            dot(randUVec(hashl(ubox.x,ubox.y,ubox.z,d)),vec3f(1-ibox.x,1-ibox.y,1-ibox.z))
          ),
        )
      ),0,0);
      /**return vec3f(lerp(ibox.y,
        lerp(ibox.z,
          dot(randUVec(hashl(lbox.x,lbox.y,lbox.z)),vec3f(ibox.x,ibox.y,ibox.z)),
          dot(randUVec(hashl(lbox.x,lbox.y,ubox.z)),vec3f(ibox.x,ibox.y,1-ibox.z))
        ),
        lerp(ibox.z,
          dot(randUVec(hashl(lbox.x,ubox.y,lbox.z)),vec3f(ibox.x,1-ibox.y,ibox.z)),
          dot(randUVec(hashl(lbox.x,ubox.y,ubox.z)),vec3f(ibox.x,1-ibox.y,1-ibox.z))
        ),
      ),randUVec(hashl(lbox.x,lbox.y,lbox.z)).z,0);*/
    }

    @compute
    @workgroup_size(8,8,1)
    fn main(
      @builtin(global_invocation_id) pix:vec3u,
    ){
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

  return tex;
}