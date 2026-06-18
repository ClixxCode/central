import { loadEnvConfig } from '@next/env';
import { Resend } from 'resend';
import type { CreateTemplateOptions } from 'resend';
import type {
  CentralTemplateVariableDefinition,
  CentralEmailTemplateDefinition,
} from '../src/lib/email/templates/registry';

const publish = process.argv.includes('--publish');
const RESEND_REQUEST_INTERVAL_MS = 300;
const RESEND_RATE_LIMIT_RETRIES = 4;
const RESEND_RATE_LIMIT_RETRY_BASE_MS = 1000;

let lastResendRequestAt = 0;

interface ResendApiResponse {
  error: {
    name: string;
    message: string;
  } | null;
}

async function main() {
  loadEnvConfig(process.cwd());

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to sync Resend templates.');
  }

  const [{ CENTRAL_EMAIL_TEMPLATE_LIST }, { EMAIL_CONFIG }] = await Promise.all([
    import('../src/lib/email/templates/registry'),
    import('../src/lib/email/client'),
  ]);
  const resend = new Resend(process.env.RESEND_API_KEY);

  for (const template of CENTRAL_EMAIL_TEMPLATE_LIST) {
    await syncTemplate(template, resend, EMAIL_CONFIG.from);
  }
}

async function syncTemplate(
  template: CentralEmailTemplateDefinition,
  resend: Resend,
  from: string
) {
  const html = await template.renderHtml();
  const payload = {
    name: template.name,
    alias: template.alias,
    subject: template.subject,
    from,
    html,
    text: template.text,
    variables: template.variables.map(toResendVariable),
  } satisfies CreateTemplateOptions;

  const existing = await callResend(() => resend.templates.get(template.alias));

  if (existing.error?.name === 'not_found') {
    const created = await callResend(() => resend.templates.create(payload));
    if (created.error) {
      throw new Error(`Failed to create ${template.alias}: ${created.error.message}`);
    }
  } else if (existing.error) {
    throw new Error(`Failed to fetch ${template.alias}: ${existing.error.message}`);
  } else {
    const updated = await callResend(() => resend.templates.update(template.alias, payload));
    if (updated.error) {
      throw new Error(`Failed to update ${template.alias}: ${updated.error.message}`);
    }
  }

  if (publish) {
    const published = await callResend(() => resend.templates.publish(template.alias));
    if (published.error) {
      throw new Error(`Failed to publish ${template.alias}: ${published.error.message}`);
    }
  }

  console.log(`${publish ? 'Published' : 'Synced'} ${template.alias}`);
}

async function callResend<T extends ResendApiResponse>(request: () => PromiseLike<T>): Promise<T> {
  for (let attempt = 0; attempt <= RESEND_RATE_LIMIT_RETRIES; attempt += 1) {
    await waitForResendRequestSlot();

    const response = await request();
    if (response.error?.name !== 'rate_limit_exceeded') {
      return response;
    }

    if (attempt === RESEND_RATE_LIMIT_RETRIES) {
      return response;
    }

    await sleep(RESEND_RATE_LIMIT_RETRY_BASE_MS * (attempt + 1));
  }

  return request();
}

async function waitForResendRequestSlot(): Promise<void> {
  const now = Date.now();
  const nextRequestAt = lastResendRequestAt + RESEND_REQUEST_INTERVAL_MS;
  const delay = nextRequestAt - now;

  if (delay > 0) {
    await sleep(delay);
  }

  lastResendRequestAt = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toResendVariable(definition: CentralTemplateVariableDefinition) {
  if (definition.type === 'number') {
    return {
      key: definition.key,
      type: 'number' as const,
      ...(typeof definition.fallbackValue === 'number'
        ? { fallbackValue: definition.fallbackValue }
        : {}),
    };
  }

  return {
    key: definition.key,
    type: 'string' as const,
    ...(typeof definition.fallbackValue === 'string' || definition.fallbackValue === null
      ? { fallbackValue: definition.fallbackValue }
      : {}),
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
