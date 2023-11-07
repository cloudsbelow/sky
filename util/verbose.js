function c_bgle(entry, i){
  let e={};
  e.binding=i;
  if(typeof(entry.v) == 'string'){
    e.visibility=0;
    if(entry.v.indexOf("c")!=-1)
      e.visibility |= GPUShaderStage.COMPUTE;
    if(entry.v.indexOf("f")!=-1)
      e.visibility |= GPUShaderStage.FRAGMENT;
    if(entry.v.indexOf("v")!=-1)
      e.visibility |= GPUShaderStage.VERTEX;
  } else if(typeof(entry.v) == 'number'){
    e.visibility=entry.v;
  } else {
    e.visibility=7;
  }
    

  const ttypes = {
    f:"float",
    n:"unfilterable-float",
    d:"depth",
    s:"sint",
    u:"uint"
  }
  const tdimensions = {
    1:"1d", 2:"2d", 3:"3d",
    c:"cube", a:"2d-array", ca:"cube-array"
  }
  if(entry.r=="t"){ //tdm
    e.texture={
      sampleType: ttypes[entry.t]??entry.t??"float",
      viewDimension: tdimensions[entry.d]??entry.d??"2d",
      multisampled: entry.m??false,
    };
    
    
  }
  if(entry.r=="w"){ //fd
    e.storageTexture={
      format: entry.f,
      viewDimension: tdimensions[entry.d]??entry.d??"2d",
    };
  }

  const stypes = {
    f:"filtering",
    n:"non-filtering",
    c:"comparison"
  }
  if(entry.r=="s"){ //t
    e.sampler = {
      type:stypes[entry.t]??entry.t??"filtering",
    }
  }

  const btypes = {
    u:"uniform",
    r:"read-only-storage",
    s:"storage",
  }
  if(entry.r=="b"){ //tos
    e.buffer = {
      type: btypes[entry.t]??entry.t??"uniform",
      hasDynamicOffset: entry.o??false,
      minBindingSize: entry.s??0,
    }
  }

  return e
}
function c_bgl(device, label, entries){
  const bgl = device.createBindGroupLayout({
    label:label,
    entries:entries.map(c_bgle)
  });
  bgl.device=device;
  return bgl
}

function c_bg(bgl, label, entries){
  const bg = bgl.device.createBindGroup({
    label:label,
    layout:bgl,
    entries:entries.map((x,i)=>{return {binding:i, resource:x}})
  });
  bg.bgl=bgl;
  return bg;
}

function c_vcp(device, label, code, entry, bgs){
  const smodule = device.createShaderModule({
    label: label+" shader",
    code: code,
  });
  const cpipe = device.createComputePipeline({
    label: label+" pipeline",
    layout:device.createPipelineLayout({
      bindGroupLayouts:bgs.map(x=>x.bgl)
    }),
    compute: {
      module: smodule,
      entryPoint: entry,
    }
  });
  return (encoder, sizeX, sizeY=1, sizeZ=1)=>{
    const pass = encoder.beginComputePass();
    pass.setPipeline(cpipe);
    bgs.forEach((bg, i) => {
      pass.setBindGroup(i,bg);
    });
    pass.dispatchWorkgroups(sizeX, sizeY, sizeZ);
    pass.end();
  }
}

function c_sam(device, label, params){ //complete this if it ever matters
  device.createSampler({
    label:label,

  })
}

screenVertexQuad = /*wgsl*/`
  @vertex
  fn vertexMain(
    @builtin(vertex_index) VertexIndex : u32
  ) -> @builtin(position) vec4<f32> {
    const pos = array(
      vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
      vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
    );

    return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  }
`;
