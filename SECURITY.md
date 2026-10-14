# Security Policy

## Overview

Punyakart is a production donation platform developed for Punyakart Foundation.

The application processes donation-related information and integrates with
third-party services for payment processing, email delivery, WhatsApp
notifications, and certificate generation.

Security issues affecting the application, infrastructure, donor information,
payment processing, authentication, or integrations should be reported
responsibly.

## Supported Version

Security fixes are applied to the actively maintained production version of
the application.

## Reporting a Security Vulnerability

If you discover a security vulnerability, do not disclose sensitive details
through a public GitHub issue.

Please report the issue privately to the Punyakart Foundation through its
official contact channel.

When reporting a vulnerability, include:

- A clear description of the vulnerability
- The affected component or endpoint
- Steps to reproduce the issue
- Potential security impact
- Relevant logs, screenshots, or proof of concept where appropriate
- Any suggested mitigation, if available

Do not include real donor information, payment credentials, API keys,
passwords, access tokens, or other secrets in the report.

## Security Practices

The application is designed to follow security practices including:

- Environment variables for secrets and credentials
- Exclusion of production `.env` files from version control
- Server-side validation of sensitive operations
- Request validation and input sanitization
- Authentication and authorization for administrative functionality
- Payment signature and webhook verification
- Rate limiting for applicable API endpoints
- CORS configuration
- Secure handling of payment and donor-related information
- Separation of frontend and backend responsibilities
- Dependency management and vulnerability auditing
- Production health and integration checks

## Secrets

The following must never be committed to the repository:

- `.env` files containing real values
- Database credentials
- MongoDB Atlas credentials
- Razorpay secrets
- Razorpay webhook secrets
- WhatsApp access tokens
- SMTP passwords
- Administrative API keys
- Private keys or certificates
- Production credentials of any kind

Use `.env.example` as the safe configuration template.

## Third-Party Services

The application integrates with third-party services such as:

- Razorpay
- MongoDB Atlas
- SMTP/email infrastructure
- WhatsApp Cloud API
- Hosting infrastructure

Each service must be configured using appropriate credentials and
security controls.

## Data Protection

Donor and payment-related information should only be accessed by
authorized personnel and services.

Production data must not be copied into development environments unless
there is a documented and authorized requirement to do so.

When debugging or sharing logs, remove personally identifiable information,
payment information, authentication credentials, and other sensitive data.

## Incident Response

In the event of a suspected security incident:

1. Restrict or disable the affected credentials or integration.
2. Preserve relevant application and infrastructure logs.
3. Determine the affected systems and data.
4. Rotate compromised credentials.
5. Apply the required remediation.
6. Verify that the vulnerability has been resolved.
7. Document the incident and corrective actions.

## Responsible Disclosure

Security researchers and contributors are encouraged to report
vulnerabilities privately and responsibly so that issues can be investigated
and resolved before public disclosure.
