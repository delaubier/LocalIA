import('@mlc-ai/web-llm').then(webllm => {
  const models = webllm.prebuiltAppConfig.model_list.map(m => m.model_id);
  console.log('--- GEMMA ---');
  console.log(models.filter(m => m.toLowerCase().includes('gemma')));
  console.log('--- LFM ---');
  console.log(models.filter(m => m.toLowerCase().includes('lfm')));
  console.log('--- QWEN 3.5 ---');
  console.log(models.filter(m => m.toLowerCase().includes('qwen3.5')));
});
