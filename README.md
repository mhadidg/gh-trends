# GitHub Trends Newsletter

Weekly newsletter featuring *fresh* trending GitHub projects. The top 20 picks only. All running on GitHub
Actions; serverless, zero operational cost, and fully automated.

[![CI](https://github.com/mhadidg/gh-trends-newsletter/workflows/CI/badge.svg)](https://github.com/mhadidg/gh-trends-newsletter/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)

![Email newsletter example](.github/assets/email-newsletter.png)

I documented my motive in a [blog post](https://mhadidg.com/posts/automating-github-trends-newsletter/). If your curious
about the technical details, the post covers that too.

## How to subscribe

You can subscribe via one of the these channels:

- Github notifications (via releases)
- Email newsletter
- RSS feed (individual repo feeds)

### Github notifications (recommended)

**Cadence**: Weekly (every Monday)

The recommend channel is *Github release*:

- Click `Watch` dropdown
- Select `Custom`
- Check `Releases`

That's it. You will get notified of new releases. Here's an example.

<p align="center">

![GitHub release notification example](.github/assets/gh-release-notif.png)

</p>

### Email newsletter

**Cadence**: Weekly (every Monday)

Subscribe [here](https://forms.gle/dbPQMaD1jamqfMg29).

> [!NOTE]
> I'm using *Google Forms* for now. That's a bit amateur-ish and super encouraging, I know. I might work on a fancy
> subscription page in the future.

### RSS feed

**Cadence**: Daily (twice daily)

You can add it to your RSS reader of choice.

```
https://raw.githubusercontent.com/mhadidg/gh-trends/refs/heads/main/feed/rss.xml
```

## Quick setup

```bash
# Install deps
npm install

# Copy default config
cp .env.example .env

# Run locally (with mock data)
npm run dev

# Preview release (with mock data)
TEMPLATE_NAME=markdown.hbs npm run preview

# Or preview release with real data (calling ClickHouse/GitHub API)
TEMPLATE_NAME=markdown.hbs npm run preview:live

```
