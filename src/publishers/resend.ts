import { Publisher } from '../types/publisher';
import { ResendClient } from '../clients/resend';
import { TaggedError } from '../utils/logging';
import { render } from '../pipeline/render';
import { ScoredRepo } from '../pipeline/rank';

export class ResendPublisher extends Publisher {
  readonly name = 'resend';

  enabled(): boolean {
    return process.env.RESEND_ENABLED === 'true';
  }

  render(repos: ScoredRepo[]): string {
    return render('release.md.hbs', repos);
  }

  async publish(repos: ScoredRepo[]): Promise<string> {
    const from = process.env.RESEND_FROM;
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (!from) {
      throw new TaggedError('config', 'RESEND_FROM required when RESEND_ENABLED=true');
    }

    if (!audienceId) {
      throw new TaggedError('config', 'RESEND_AUDIENCE_ID required when RESEND_ENABLED=true');
    }

    const limit = parseInt(process.env.RELEASE_TOP_N || '20');
    repos = repos.slice(0, limit);

    const content = this.render(repos);
    const client = new ResendClient(process.env.RESEND_API_KEY);

    const result = await client.sendEmail({
      from,
      audience_id: audienceId,
      subject: this.subject(),
      name: this.subject(),
      html: content,
    });

    return result.id;
  }
}
