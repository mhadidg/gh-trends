import { Publisher } from '../types/publisher';
import { ResendClient } from '../clients/resend';
import { TaggedError } from '../utils/logging';
import { render } from '../pipeline/render';
import { ScoredRepo } from '../pipeline/select';

export class ResendPublisher extends Publisher {
  readonly name = 'resend';

  enabled(): boolean {
    return process.env.RESEND_ENABLED === 'true';
  }

  render(repos: ScoredRepo[]) {
    return {
      html: render('html.hbs', repos),
      text: render('text.hbs', repos),
    };
  }

  async publish(repos: ScoredRepo[]): Promise<string> {
    const from = process.env.RESEND_FROM;
    if (!from) {
      throw new TaggedError('config', 'RESEND_FROM required when RESEND_ENABLED=true');
    }

    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) {
      throw new TaggedError('config', 'RESEND_AUDIENCE_ID required when RESEND_ENABLED=true');
    }

    const content = this.render(repos);
    const client = new ResendClient(process.env.RESEND_API_KEY);

    const replyTo = process.env.RESEND_REPLY_TO;
    const result = await client.sendEmail({
      from,
      audience_id: audienceId,
      subject: this.subject(),
      name: this.subject(),
      html: content.html,
      text: content.text,
      ...(replyTo && { reply_to: replyTo }),
    });

    return result.id;
  }
}
