import Joi from 'joi'
import type { CreateMatchDto, UpdateScoreDto } from '@obs-scoring/shared'

export const createMatchSchema = Joi.object<CreateMatchDto>({
  player1: Joi.string().required().min(1).max(100),
  player2: Joi.string().required().min(1).max(100),
  team1: Joi.string().allow('', null).max(100).optional(),
  team2: Joi.string().allow('', null).max(100).optional(),
})

export const updateScoreSchema = Joi.object<UpdateScoreDto>({
  player1Score: Joi.number().integer().min(0).required(),
  player2Score: Joi.number().integer().min(0).required(),
})

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
})
