import { Publisher } from '../types/publisher';
import { ButtondownClient } from '../clients/buttondown';
import { render } from '../pipeline/render';
import { ScoredRepo } from '../pipeline/rank';

export class ButtondownPublisher extends Publisher {
  readonly name = 'buttondown';

  enabled(): boolean {
    return process.env.BUTTONDOWN_ENABLED === 'true';
  }

  render(repos: ScoredRepo[]): string {
    return render('html.hbs', repos);
  }

  async publish(repos: ScoredRepo[]): Promise<string> {
    const limit = parseInt(process.env.RELEASE_TOP_N || '20');
    repos = repos.slice(0, limit);

    const content = this.render(repos);
    const client = new ButtondownClient(process.env.BUTTONDOWN_API_KEY);
    const result = await client.sendEmail({
      subject: this.subject(),
      body: content,
      email_type: 'public',
    });

    return result.id;
  }
}
