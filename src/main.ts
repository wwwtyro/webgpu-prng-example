(async () => {
  const canvas = document.getElementById("render-canvas")! as HTMLCanvasElement;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  if (!navigator.gpu) {
    console.log(
      "WebGPU doesn't appear to be supported in this browser. Aborting."
    );
    document.body.innerHTML =
      "WebGPU doesn't appear to be supported in this browser. Aborting.";
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();

  if (adapter === null) {
    console.log("Failed to acquire GPUAdapter, aborting.");
    return;
  }

  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");

  if (context === null) {
    console.log("Failed to acquire WebGPU context, aborting.");
    return;
  }

  const preferredFormat = context.getPreferredFormat(adapter);
  context.configure({
    device,
    format: preferredFormat,
    size: [canvas.width, canvas.height],
  });

  const shaderModule = device.createShaderModule({
    code: `
      [[block]] struct Uniforms {
        offset: u32;
      };

      [[binding(0), group(0)]] var<uniform> uniforms: Uniforms;

      var<private> state: u32;

      // From https://www.reedbeta.com/blog/hash-functions-for-gpu-rendering/
      fn pcg_hash(input: u32) -> u32 {
          state = input * 747796405u + 2891336453u;
          let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
          return (word >> 22u) ^ word;
      }

      [[stage(vertex)]]
      fn vs_main([[location(0)]] position : vec2<f32>) -> [[builtin(position)]] vec4<f32> {
        return vec4<f32>(position, 0.0, 1.0);
      }


      [[stage(fragment)]]
      fn fs_main(
        [[builtin(position)]] position: vec4<f32>,
      ) -> [[location(0)]] vec4<f32> {
        let seed = u32(512.0 * position.y + position.x) + uniforms.offset;
        let pcg = pcg_hash(seed);
        let v = f32(pcg) * (1.0 / 4294967295.0);
        return vec4<f32>(v, v, v, 1.0);
      }
    `,
  });

  const positions = new Float32Array([
    -1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
  ]);

  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(positionBuffer.getMappedRange()).set(positions);
  positionBuffer.unmap();

  const pipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: preferredFormat,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  const uniformBuffer = device.createBuffer({
    size: 1 * 4, // One u32, 4 bytes each
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  const uniforms = new Uint32Array(1);

  function renderLoop() {
    uniforms[0] = Math.round(Math.random() * 4294967295);

    device.queue.writeBuffer(
      uniformBuffer,
      0,
      uniforms.buffer,
      uniforms.byteOffset,
      uniforms.byteLength
    );

    const commandEncoder = device.createCommandEncoder();
    const textureView = context!.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          loadValue: { r: 0.125, g: 0.125, b: 0.25, a: 1 },
          storeOp: "store",
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.draw(6, 1, 0, 0);
    passEncoder.endPass();

    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
})();
