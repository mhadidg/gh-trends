import { HttpError, TaggedError } from '../utils/logging';

export interface ResendEmailPayload {
  subject: string;
  from: string;
  audience_id: string;
  name?: string;
  html?: string;
  text?: string;
}

export class ResendClient {
  public static readonly baseUrl = 'https://api.resend.com/broadcasts';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    if (!apiKey) throw new TaggedError('config', 'RESEND_API_KEY required');
    this.apiKey = apiKey;
  }

  async sendEmail(email: ResendEmailPayload): Promise<{ id: string }> {
    const broadcastRes = await fetch(ResendClient.baseUrl, {
      method: 'POST',
      body: JSON.stringify(email),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!broadcastRes.ok) {
      throw new HttpError('resend', 'draft creation failed', broadcastRes);
    }

    const broadcastJson = await broadcastRes.json();
    if (!broadcastJson.id) {
      throw new HttpError('resend', 'drafting returned no ID', broadcastRes);
    }

    if (process.env.RESEND_DRAFT !== 'true') {
      const sendRes = await fetch(`${ResendClient.baseUrl}/${broadcastJson.id}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!sendRes.ok) {
        throw new HttpError('resend', 'email sending failed', sendRes);
      }
    }

    return { id: broadcastJson.id };
  }
}
