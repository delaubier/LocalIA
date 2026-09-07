const webllm = require('@mlc-ai/web-llm');
const models = webllm.prebuiltAppConfig.model_list.map(m => m.model_id);
console.log(models.filter(m => m.toLowerCase().includes('gemma')));
console.log(models.filter(m => m.toLowerCase().includes('lfm')));
console.log(models.filter(m => m.toLowerCase().includes('qwen3.5')));
