# N4 Stack

## Quick Start Guide

### Prerequisites

Initialize [Supabase Project](https://supabase.com/dashboard/sign-in?returnTo=%2Fprojects)

> Locate your **Supabase Project URL & Anon Key** in your Supabase project's Settings --> API section.

Sign up for Cloudflare

> You will need to sign up for a Cloudflare account to use the N4 Stack. You can sign up for a free account [here](https://dash.cloudflare.com/sign-up).

### Recommended

Add a domain to Cloudflare

> Not required, but recommended. You can add a domain to Cloudflare [here](https://dash.cloudflare.com/?to=/:account/:zone/dns).

Create an R2 bucket

> R2, which is Cloudflare's equivalent to AWS S3, is used to store your static assets. You can create an R2 bucket [here](https://dash.cloudflare.com/?to=/:account/storage/buckets).

> Note: We have found setting up an R2 bucket with a public URL before hand is the fastest way to get started. Cloudflare's api lack an easy way to get a bucket's public URL or adding one to a created bucket.

Attach a domain to your R2 bucket to make it public

> Public Bucket is a feature that allows users to expose the contents of their R2 buckets directly to the Internet. By default, buckets are never publicly accessible and will always require explicit user permission to enable.

[Documentation on how to attach a domain to your R2 bucket](https://developers.cloudflare.com/r2/buckets/public-buckets/#managed-public-buckets-through-r2dev).

**Example**: assets.nicholasoxford.com is my R2 bucket's custom domain

## Create a Cloudflare API key

You will pass this into the n4-cli to authorize the creation of your project.

- You can create a Cloudflare API key [here](https://dash.cloudflare.com/profile/api-tokens).

- Click the "Create Token" button

- Choose **Edit Cloudflare Workers** template

> For the best experience, we recommend adding DNS and D1 permissions

- Under `Permissions` select `+ Add More` and chose Account > D1 > Edit

- Under `Permissions` select `+ Add More` and chose Zone > DNS > Edit

- Account Resources: `Include > All Accounts`

- Zone Resources: `Include > All Zones`

- Click `Continue to Summary`

> Make sure to save your API key somewhere safe. You will not be able to see it again without rollibng a new one.

### How to run the N4 Stack

```bash
npx n4-cli [options]
```

### Options

- **-D, --destination <path>**: 📂 Choose the destination path for cloning the repository.
- **-N, --project-name [value]**: 🏷️ Specify a custom name for your project.
- **--api_key [value]**: 🔐 Enter the API Key for your Cloudflare account.
- **--SUPABASE_URL [value]**: 🌐 Provide your Supabase Project URL.
- **--SUPABASE_ANON_KEY [value]**: 🔑 Input your Supabase Project Anon Key.
- **--R2_PUBLIC_URL [value]**: 🔗 Specify your R2 Public URL.
- **--R2_BUCKET_NAME [value]**: 🔗 Enter the name of your R2 bucket.
- **--D1_DATABASE_ID [value]**: 🆔 Input the ID of your D1 Database.
- **--D1_DATABASE_NAME [value]**: ⑆ Name your D1 Database.

## The N4 Stack

Writing zero-user weekend apps is apart of software engineers journey. The N4 Stack gets you passed so many of the annoying parts of setting up a site, with Auth, so you can focus on the fun parts. Even if you app scales beyond a weekend project, the N4 stack is ready to handle it.

I have clocked deploys at 36 seconds 🏎️

## Features

- **Remix App**: Start with a [Remix app](https://remix.run/), a React framework for building production-grade apps.
- **Cloudflare Pages**: Deploy your app to [Cloudflare Pages](https://pages.cloudflare.com/) with a single command.
- **R2 CDN**: Leverage the power of Cloudflare's network with their [R2 CDN](https://www.cloudflare.com/developer-platform/r2/), zero egress fee object storage.
- **D1 Database**: Cloudflare's database offering, [D1](https://www.cloudflare.com/developer-platform/d1/), is a serverless sqlite database with features and perfomance that rivals other leading vendors.
- **Supabase Authentication**: Supabase is an open source Firebase alternative. We are using them for authentication.
  > Note: I know Supabase gives you a Postres database with tons of features, I have found the perfomance of D1 + Workers/Pages to be unbeatable.
  > TODO: Add a flag to roll your own auth in D1 and skip the Supabase setup. This wont be the default because I think Supabase as a platform is great.
- **Shadcn**: "Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source." - [Shadcn](https://shadcn.com/)

## TODO:

- [x] Add section to readme about steps to do before running npx n4-cli
- [ ] Switch to monorepo with frontend code
- [x] Check URL of deployed pages project
- [x] set custom url for pages project
- [x] check if deployment was successful
- [x] before creating, check name, and prompt user
- [x] If no R2 bucket or D1, skip the package edit steps
- [x] Add a flag to skip the R2 setup
- [x] Add a flag to skip the D1 setup
- [ ] Add a flag to skip the Supabase setup
