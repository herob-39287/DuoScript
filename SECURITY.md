# Security Policy

## Supported Versions

We support the latest major version of DuoScript.

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

DuoScript is an open-source project maintained by individuals. We take security seriously and appreciate your help in improving the safety of this application.

### Where to report

If you believe you have found a security vulnerability, please **DO NOT** open a public issue.
Instead, please report it by emailing the maintainer directly (if an email is provided in the profile) or by creating a [GitHub Security Advisory](https://github.com/advisories) draft if you have the permissions.

If no private channel is available, please open an issue asking for a way to contact the maintainers privately regarding a security matter.

### What to include

Please include as much information as possible to help us reproduce and fix the issue, such as:
- A description of the vulnerability.
- Steps to reproduce.
- Potential impact.

### Response

We will do our best to respond to your report within a reasonable timeframe. Please note that as a community-driven project, response times may vary.

## API Key Safety

DuoScript operates on a **BYOK (Bring Your Own Key)** model.
- The application stores the API key in the browser's memory/environment variables during runtime.
- It is the user's responsibility to keep their API keys secure and not share screenshots containing them.
- We will never ask for your API key in issues or pull requests.
