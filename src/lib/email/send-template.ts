import { EMAIL_CONFIG, resend } from './client';
import {
  getCentralEmailTemplate,
  RESEND_STRING_VARIABLE_MAX_LENGTH,
  type CentralEmailTemplateAlias,
  type CentralTemplateVariableDefinition,
  type CentralTemplateVariables,
  type CentralTemplateVariableValue,
} from './templates/registry';

export interface SendCentralTemplateEmailOptions {
  templateAlias: CentralEmailTemplateAlias;
  to: string | string[];
  subject?: string;
  variables: Partial<CentralTemplateVariables>;
  from?: string;
  replyTo?: string | string[];
}

export function normalizeTemplateVariables(
  definitions: CentralTemplateVariableDefinition[],
  variables: Partial<CentralTemplateVariables>
): CentralTemplateVariables {
  return definitions.reduce<CentralTemplateVariables>((normalized, definition) => {
    const value = variables[definition.key];
    const hasValue = value !== undefined && value !== null && value !== '';

    if (!hasValue) {
      if (definition.required) {
        throw new Error(`Missing required email template variable: ${definition.key}`);
      }

      if (definition.fallbackValue !== undefined && definition.fallbackValue !== null) {
        normalized[definition.key] = definition.fallbackValue;
      }

      return normalized;
    }

    normalized[definition.key] = normalizeTemplateVariableValue(definition, value);
    return normalized;
  }, {});
}

function normalizeTemplateVariableValue(
  definition: CentralTemplateVariableDefinition,
  value: CentralTemplateVariableValue
): CentralTemplateVariableValue {
  if (definition.type === 'number') {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new Error(`Email template variable must be numeric: ${definition.key}`);
    }

    return numberValue;
  }

  const stringValue = String(value);

  if (definition.key.endsWith('_URL')) {
    assertHttpUrl(definition.key, stringValue);
  }

  if (stringValue.length <= RESEND_STRING_VARIABLE_MAX_LENGTH) {
    return stringValue;
  }

  return `${stringValue.slice(0, RESEND_STRING_VARIABLE_MAX_LENGTH - 3)}...`;
}

function assertHttpUrl(key: string, value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Email template variable must be an absolute URL: ${key}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Email template URL must use http or https: ${key}`);
  }
}

export async function sendCentralTemplateEmail({
  templateAlias,
  to,
  subject,
  variables,
  from = EMAIL_CONFIG.from,
  replyTo = EMAIL_CONFIG.replyTo,
}: SendCentralTemplateEmailOptions) {
  const template = getCentralEmailTemplate(templateAlias);
  const normalizedVariables = normalizeTemplateVariables(template.variables, variables);

  return resend.emails.send({
    from,
    replyTo,
    to,
    subject: subject ?? template.subject,
    template: {
      id: template.alias,
      variables: normalizedVariables,
    },
  });
}
