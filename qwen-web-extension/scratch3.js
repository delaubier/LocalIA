import('@mlc-ai/web-llm').then(webllm => {
  const models = webllm.prebuiltAppConfig.model_list.map(m => m.model_id);
  console.log(models);
});
