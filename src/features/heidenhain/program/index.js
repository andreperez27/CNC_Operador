import { registerTemplate, generateProgram, getRegisteredOperations } from './programEngine';
import { chamferExternalTemplate } from './templates/chamferExternalTemplate';
import { chamferInternalTemplate } from './templates/chamferInternalTemplate';

registerTemplate('chamferExternal', chamferExternalTemplate);
registerTemplate('chamferInternal', chamferInternalTemplate);

export { generateProgram, getRegisteredOperations };
