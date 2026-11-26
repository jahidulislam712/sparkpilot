# SparkPilot

[![CI](https://github.com/jahidulislam712/sparkpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/jahidulislam712/sparkpilot/actions/workflows/ci.yml)

Multi-tenant AI support SaaS.

## GitHub setup

On `main`, enable a branch protection rule that requires the `Validate` and `Docker build` CI jobs.

Configure the `production` GitHub Environment with:

- `DEPLOY_HOOK_URL` for the deployment target
- `DEPLOY_HOOK_TOKEN` for deploy-hook authorization
- `SMOKE_URL` for the deployed API base URL

Deployments are dry-run when `DEPLOY_HOOK_URL` is absent.
