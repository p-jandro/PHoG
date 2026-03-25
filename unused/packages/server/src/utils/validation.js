/**
 * Event validation using Joi
 */

import Joi from 'joi';

/**
 * Validation schemas for different events
 */
export const schemas = {
  // Player join
  playerJoin: Joi.object({
    name: Joi.string().min(1).max(30).required(),
    reconnectToken: Joi.string().uuid().optional()
  }),

  // Host join
  hostJoin: Joi.object({
    password: Joi.string().required()
  }),

  // Quiz vote
  quizVote: Joi.object({
    category: Joi.string().valid('easy', 'medium', 'hard', 'impossible').required()
  }),

  // Quiz answer
  quizAnswer: Joi.object({
    questionId: Joi.string().uuid().required(),
    answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
    timeRemaining: Joi.number().min(0).required()
  }),

  // True/False answer
  trueFalseAnswer: Joi.object({
    statementId: Joi.string().uuid().required(),
    answer: Joi.boolean().required()
  }),

  // Countdown word submission
  countdownWord: Joi.object({
    word: Joi.string().min(1).max(9).uppercase().required(),
    letters: Joi.array().items(Joi.string().length(1).uppercase()).required()
  }),

  // Host game control
  hostControl: Joi.object({
    action: Joi.string().valid('start', 'pause', 'resume', 'next', 'reset', 'end').required(),
    game: Joi.string().valid('quiz', 'trueFalse', 'countdown').optional()
  }),

  // Host player management
  hostPlayerAction: Joi.object({
    playerId: Joi.string().uuid().required(),
    action: Joi.string().valid('kick', 'adjustScore').required(),
    value: Joi.number().optional() // For score adjustment
  })
};

/**
 * Validate event data against a schema
 * @param {string} schemaName - Name of schema to use
 * @param {Object} data - Data to validate
 * @returns {Object} - { valid: boolean, data: Object, error: string }
 */
export function validateEvent(schemaName, data) {
  const schema = schemas[schemaName];
  
  if (!schema) {
    return {
      valid: false,
      error: `Unknown schema: ${schemaName}`
    };
  }

  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      valid: false,
      error: error.details.map(d => d.message).join(', ')
    };
  }

  return {
    valid: true,
    data: value
  };
}

/**
 * Middleware to validate socket events
 * @param {string} schemaName - Name of schema to use
 * @returns {function} - Validation middleware
 */
export function validateSocketEvent(schemaName) {
  return (data, callback) => {
    const result = validateEvent(schemaName, data);
    
    if (!result.valid) {
      if (typeof callback === 'function') {
        callback({ success: false, error: result.error });
      }
      return false;
    }

    return result.data;
  };
}

/**
 * Validate player name
 * @param {string} name - Player name
 * @returns {boolean}
 */
export function isValidPlayerName(name) {
  return typeof name === 'string' && 
         name.length >= 1 && 
         name.length <= 30 &&
         /^[a-zA-Z0-9\s_-]+$/.test(name);
}

/**
 * Sanitize player name
 * @param {string} name - Player name
 * @returns {string}
 */
export function sanitizePlayerName(name) {
  return name
    .trim()
    .substring(0, 30)
    .replace(/[^a-zA-Z0-9\s_-]/g, '');
}

