# Changelog

All notable changes to the Punyakart project are documented in this file.

The format is based on the principles of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Planned

- Complete migration from MySQL persistence to MongoDB Atlas.
- Migrate persistent JSON-based backend records to appropriate MongoDB
  collections where applicable.
- Implement MongoDB repositories while preserving existing service and API
  behavior.
- Add and verify MongoDB indexes for production queries.
- Implement safe receipt-number allocation using MongoDB atomic operations.
- Migrate and verify existing donation and campaign data.
- Document MongoDB migration and rollback procedures.
- Update environment configuration for MongoDB Atlas.
- Update deployment documentation after the database migration is completed.

### Documentation

- Added project ownership and contributor attribution documentation.
- Added proprietary project licensing terms.
- Added security guidelines.
- Added contribution guidelines.
- Added code of conduct documentation.

## [2026-10-01]

### Architecture

- Consolidated campaign frontend components into a centralized campaign
  component structure.
- Centralized campaign data and campaign types.
- Consolidated frontend assets under the main frontend assets directory.
- Removed redundant campaign frontend directory structures.
- Separated frontend campaign architecture from backend persistence logic.

### Frontend

- Verified campaign navigation and campaign pages.
- Verified the homepage and campaign discovery workflow.
- Verified the donation interface and Razorpay donation initiation flow.
- Verified administrative route access behavior.
- Verified donor donation-history route behavior.

### Validation

- TypeScript validation completed successfully.
- Production frontend build completed successfully.
- Frontend architecture cleanup was committed to the dedicated
  `architecture-cleanup` branch.

## [2026-09]

### Repository

- Re-established a clean Git repository history for the Punyakart project.
- Added a sanitized `.env.example` configuration.
- Established a clean baseline for continued development.

### Frontend Architecture

- Began consolidation of campaign-related frontend structures.
- Began organizing shared campaign components, types, data, and assets.

## Earlier Development

The project previously contained functionality for:

- Campaign discovery and campaign pages
- Donation initiation and payment processing
- Razorpay integration
- Donation records and receipts
- Donation certificates
- Email notifications
- WhatsApp notifications
- Administrative functionality
- Campaign management
- Donor-related workflows

Historical implementation details may differ from the current architecture.

---

## Versioning Notes

The project does not currently use formal semantic version tags for every
development change.

Release versions should be added when production releases are formally
identified.

Example:

```text
## [1.0.0] - YYYY-MM-DD

### Added

- Feature description

### Changed

- Change description

### Fixed

- Bug fix description

### Security

- Security-related change
