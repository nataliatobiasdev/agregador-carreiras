import { v7 } from 'uuid'

/** Time-ordered UUID v7, used as primary key for every table. */
export const newId = (): string => v7()
