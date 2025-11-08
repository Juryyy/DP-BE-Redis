import Joi from 'joi';

export const uploadFilesSchema = Joi.object({
  userId: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const submitPromptsSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  prompts: Joi.array()
    .items(
      Joi.object({
        content: Joi.string().required().min(1).max(10000),
        priority: Joi.number().integer().min(0).required(),
        targetType: Joi.string()
          .valid('FILE_SPECIFIC', 'LINE_SPECIFIC', 'SECTION_SPECIFIC', 'GLOBAL')
          .required(),
        targetFileId: Joi.string()
          .uuid()
          .when('targetType', {
            is: Joi.string().valid('FILE_SPECIFIC', 'LINE_SPECIFIC'),
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
        targetLines: Joi.object({
          start: Joi.number().integer().min(1).required(),
          end: Joi.number().integer().min(1).required(),
        }).when('targetType', {
          is: 'LINE_SPECIFIC',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        targetSection: Joi.string().when('targetType', {
          is: 'SECTION_SPECIFIC',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
      })
    )
    .min(1)
    .required(),
});

export const clarificationResponseSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  clarificationId: Joi.string().uuid().required(),
  response: Joi.string().required().min(1).max(5000),
});

export const confirmResultSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  resultId: Joi.string().uuid().required(),
  action: Joi.string().valid('CONFIRM', 'MODIFY', 'REGENERATE').required(),
});

export const modifyResultSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  resultId: Joi.string().uuid().required(),
  modifications: Joi.alternatives()
    .try(
      Joi.string().min(1).max(10000), // Direct edit
      Joi.array().items(
        // New prompts
        Joi.object({
          content: Joi.string().required().min(1).max(10000),
          priority: Joi.number().integer().min(0).required(),
        })
      )
    )
    .required(),
});

export const aiProviderConfigSchema = Joi.object({
  provider: Joi.string().valid('ollama', 'ollama-remote', 'openai', 'gemini').required(),
  model: Joi.string().optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  maxTokens: Joi.number().integer().min(1).max(200000).optional(),
});
