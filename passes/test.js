function mTestPipe(device, context, canvas,tex){
  const tShader = device.createShaderModule({
    label: "main sky shader",
    code: /*wgsl*/`
    @group(0) @binding(0) var tex:texture_3d<f32>;
    @group(0) @binding(1) var sam:sampler;

    struct camStruct {
      pMatrix:mat4x4f,
      aInv:mat4x4f,
    }
    @group(1) @binding(0) var<uniform> cam: camStruct;

    override width:u32;
    override height:u32;

    ${screenVertexQuad}
    @fragment
    fn fragmentMain(
      @builtin(position) pix:vec4f,
    )->@location(0) vec4f{
      let ndc=vec3f(pix.xy, 0.5)/vec3f(f32(width),f32(height),modf(cam.pMatrix[3][3]/200).fract);
      let color = textureSampleLevel(tex,sam,ndc.zxy,0);
      return vec4f((color/2+0.5).rgb,1);
    }
    `
  });

  const bgl = c_bgl(device, "tlayout", [{r:"t", d:3, t:"n"},{r:"s", t:"n"}]);
  const bg = c_bg(bgl, "tbg",[tex.createView(),device.createSampler({
    label: "tsam",
    addressModeU:"repeat",
    addressModeV:"repeat",
    addressModeW:"repeat",
  })])

  const tPipe = device.createRenderPipeline({
    label:"tPipe",
    layout: device.createPipelineLayout({
      label: "tPipe",
      bindGroupLayouts:[bgl,bgs.cam.bgl],
    }),
    vertex: {
      module: tShader,
      entryPoint: 'vertexMain'
    },
    fragment:{
      module: tShader,
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
    pass.setPipeline(tPipe);
    pass.setBindGroup(0,bg);
    pass.setBindGroup(1,bgs.cam);
    pass.draw(6);
    pass.end();
  }
}