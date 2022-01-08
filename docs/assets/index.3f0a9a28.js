const b=function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))i(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const s of t.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function r(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerpolicy&&(t.referrerPolicy=e.referrerpolicy),e.crossorigin==="use-credentials"?t.credentials="include":e.crossorigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function i(e){if(e.ep)return;e.ep=!0;const t=r(e);fetch(e.href,t)}};b();(async()=>{const o=document.getElementById("render-canvas");if(o.width=o.clientWidth,o.height=o.clientHeight,!navigator.gpu){console.log("WebGPU doesn't appear to be supported in this browser. Aborting."),document.body.innerHTML="WebGPU doesn't appear to be supported in this browser. Aborting.";return}const n=await navigator.gpu.requestAdapter();if(n===null){console.log("Failed to acquire GPUAdapter, aborting.");return}const r=await n.requestDevice(),i=o.getContext("webgpu");if(i===null){console.log("Failed to acquire WebGPU context, aborting.");return}const e=i.getPreferredFormat(n);i.configure({device:r,format:e,size:[o.width,o.height]});const t=r.createShaderModule({code:`
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
    `}),s=new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),c=r.createBuffer({size:s.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0});new Float32Array(c.getMappedRange()).set(s),c.unmap();const f=r.createRenderPipeline({vertex:{module:t,entryPoint:"vs_main",buffers:[{arrayStride:Float32Array.BYTES_PER_ELEMENT*2,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:t,entryPoint:"fs_main",targets:[{format:e}]},primitive:{topology:"triangle-list"}}),d=r.createBuffer({size:1*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),g=r.createBindGroup({layout:f.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:d}}]}),u=new Uint32Array(1);function l(){u[0]=Math.round(Math.random()*4294967295),r.queue.writeBuffer(d,0,u.buffer,u.byteOffset,u.byteLength);const p=r.createCommandEncoder(),m={colorAttachments:[{view:i.getCurrentTexture().createView(),loadValue:{r:.125,g:.125,b:.25,a:1},storeOp:"store"}]},a=p.beginRenderPass(m);a.setPipeline(f),a.setBindGroup(0,g),a.setVertexBuffer(0,c),a.draw(6,1,0,0),a.endPass(),r.queue.submit([p.finish()]),requestAnimationFrame(l)}requestAnimationFrame(l)})();
