import('@mlc-ai/web-llm').then(webllm => {
  const models = webllm.prebuiltAppConfig.model_list.map(m => m.model_id);
  console.log('--- LFM ---');
  console.log(models.filter(m => m.toLowerCase().includes('lfm')));
  console.log('--- LLAMA ---');
  console.log(models.filter(m => m.toLowerCase().includes('llama')));
});
