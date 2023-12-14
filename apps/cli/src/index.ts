#! /usr/bin/env node

import ora from "ora";
import chalk from "chalk";
import figlet from "figlet";
import { Command } from "commander";
import { select, confirm, input } from "@inquirer/prompts";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { promises } from "fs";

// Create cli program helper and check options
const program = new Command();

// Enhanced message with chalk styles and emojis
const description =
  chalk.green("Deploy the ") +
  chalk.blue.bold("N4 stack ") +
  chalk.green("- A ") +
  chalk.magenta.bold("Remix ") +
  chalk.green("App deployed to ") +
  chalk.yellow.bold("Cloudflare ") +
  chalk.green("Pages with a D1 Database (Sqlite) and R2 CDN + ") +
  chalk.cyan.bold("Supabase 🔑 ") +
  chalk.green("for Auth");

program
  .version("1.0.0")
  .description(description)
  .option("-N, --project-name [value]", "🏷️ Enter a name for your project")
  .option("--api_key [value]", "🔐 API Key for your Cloudflare Account")
  .option("--SUPABASE_URL [value]", "🌐 Supabase Project URL")
  .option("--SUPABASE_ANON_KEY [value]", "🔑 Supabase Project Anon Key")
  .option("--R2_PUBLIC_URL [value]", "🔗 R2 Public URL")
  .option("--R2_BUCKET_NAME [value]", "🔗 R2 Public URL")
  .option("--no-R2", "🚫 Don't use an R2 bucket for this project")
  .option("--no-D1", "🚫 Don't use a D1 Database for this project")
  .option("--TOP_LEVEL_DOMAIN [value]", "🌐 Top Level Domain")
  .option("--TOP_LEVEL_DOMAIN_ID [value]", "⩤ Top Level Domain ID")
  .option("--account_id [value]", "🧾 Cloudflare Account ID")

  .option("--D1_DATABASE_ID [value]", "🆔 D1 Database ID")
  .option("--D1_DATABASE_NAME [value]", "⑆ D1 Database Name")
  .option("--project_name [value]", "📝 Name of pages project")
  .option(
    "-D, --destination <path>",
    "📂 Specify the destination path where you want the repo to be cloned"
  )
  .parse(process.argv);
let globalInfo: GlobalInfo = {
  ...program.opts<GlobalInfo>(),
};

main();

async function main() {
  // Cool CLI font when starting CLI tool
  console.log(figlet.textSync("N4", "ANSI Shadow"));
  console.log(figlet.textSync("CLI", "ANSI Shadow"));

  await checkAndDeployCloudflareResources();
  await checkSupabaseResources();

  // Create new CF Pages project or make sure user
  // has rights for the one they passed in
  if (globalInfo.project_name) {
    await getCloudflarePagesProjectInfo();
  } else {
    await createCloudFlarePagesProject();
  }

  await copyN4FilesFromGit();
  await updateProjectFiles();
  await installDependencies();
  await deployCloudFlarePagesProject();
  // I need to add DNS records to the zone to get
  // custom domains fully set up
  // if (globalInfo.TOP_LEVEL_DOMAIN_ID) {
  //   await addCustomURL();
  // }
  await getFinalProjectInfo();
}

async function addCustomURL() {
  const doesUserWantToUseCustomDomain = await confirm({
    message: `Do you want to use a custom domain with your project?`,
    default: true,
  });

  if (!doesUserWantToUseCustomDomain) {
    return;
  }

  // enter top level url into URL and only take out www. if it exists
  const parsedUrl = new URL(ensureURLProtocol(globalInfo.TOP_LEVEL_DOMAIN));
  const topLevelDomain = parsedUrl.hostname.replace("www.", "");

  const urlInput = await input({
    message: `Enter the domain you want to use:`,
    default: `example.${topLevelDomain}`,
  });

  const spinner = ora({
    text: `Adding custom domain to your project`,
    color: "yellow",
  }).start();

  let options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`,
    },
    body: JSON.stringify({
      name: urlInput,
    }),
  };

  //let url = 'https://api.cloudflare.com/client/v4/accounts/account_identifier/pages/projects/project_name/domains';
  let url = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/pages/projects/${globalInfo.project_name}/domains`;
  const addCustomDomainResponse = await fetch(url, options);
  spinner.stop();
  if (!addCustomDomainResponse.ok) {
    chalk.yellow(
      `There was an error adding your custom domain: ${urlInput}.... ${addCustomDomainResponse.statusText}`
    );
    return;
  }
  globalInfo.custom_domain = urlInput;
  console.log(
    chalk.green(
      `Added custom domain: ${chalk.blue(
        globalInfo.custom_domain
      )} to your project`
    )
  );
  // warning with emoji that it might take a few minutes to deploy
  console.log(
    chalk.yellow(
      `⚠️ It might take a few minutes for your custom domain to deploy`
    )
  );
}

/**
The goal here is to parse a users API key and ask:
1. What account they want to use
2. If they want to use an url associated with that account
3. If they want to use a pre-existing bucket associated with that account
4. Does that bucket have a domain associated with it
5. If no bucket, create one
6. repeat 3-5 for D1 Database
*/
async function checkAndDeployCloudflareResources() {
  if (!globalInfo.name) {
    globalInfo.name = await input({
      message: "Enter the name of your project:",
      default: "n4-stack",
    });
  }
  if (!globalInfo.destination) {
    globalInfo.destination = await input({
      message:
        "Enter the destination path where you want the repo to be cloned:",
      default: `./${globalInfo.name}`,
    });
  }
  await grabAPIKey();
  await verifyAccount();
  const potentialAccounts = await fetchPotentialAccounts();
  await selectAccount(potentialAccounts);
  await grabZonesSelectURL();
  if (globalInfo.R2) {
    await grabR2BucketInfo();
  }
  if (globalInfo.D1) {
    await checkForPreExistingD1Databases();
  }
}

async function deployCloudFlarePagesProject() {
  const builderSpinner = ora({
    text: `Building project`,
    color: "yellow",
  }).start();
  const command = spawn("npm", ["run", "build"], {
    cwd: globalInfo.destination,
  });

  // run wrangler pages deploy ./public --project-name={globalInfo.name} in child directory

  await execAsync(command);
  builderSpinner.stop();
  console.log(chalk.green("✅ Project built successfully"));
  // go into child directory and run npm run pages:deploy with env variable CLOUDFLARE_API_KEY=${globalInfo.api_key}
  const spinner = ora({
    text: `Deploying Cloudflare Pages Project ${globalInfo.name} to ${globalInfo.pages_domain}`,
    color: "yellow",
  }).start();
  const deployCommand = spawn(
    "npx",
    [
      "wrangler",
      "pages",
      "deploy",
      "./public",
      `--project-name=${globalInfo.name}`,
    ],
    {
      cwd: globalInfo.destination,
      env: {
        ...process.env, // Copy existing environment variables
        CLOUDFLARE_API_KEY: globalInfo.api_key, // Set the specific env var
      },
      shell: true, // This can be helpful on UNIX systems
    }
  );
  await execAsync(deployCommand);
  spinner.stop();
  console.log(chalk.green("✅ Project deployed successfully to Cloudflare"));
}

/**
1. Check to see if the user passed in the Supabase URL and Anon Key via the CLI. 
2. If not prompt the for it
3. After we have the URL and Key, we do a simple call to Supabase to see if the URL and Key are valid.
 */
async function checkSupabaseResources() {
  if (!globalInfo.SUPABASE_URL) {
    globalInfo.SUPABASE_URL = await input({
      message: "Enter the Supabase Project URL:",
    });
  }
  if (!globalInfo.SUPABASE_ANON_KEY) {
    globalInfo.SUPABASE_ANON_KEY = await input({
      message: "Enter the Supabase Project Anon Key:",
    });
  }

  await grabSupabaseInfo();

  console.log(chalk.green(`Supabase account ${chalk.greenBright("verified")}`));
}

async function getFinalProjectInfo() {
  const spinner = ora({
    text: `Checking Pages Project: ${globalInfo.project_name}`,
    color: "yellow",
  });

  let url = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/pages/projects/${globalInfo.project_name}`;
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },
  };
  const getPagesProjectResponse = await fetch(url, options);
  spinner.stop();
  if (!getPagesProjectResponse.ok) {
    console.log(
      chalk.red(
        `There was an issue on the final check of your project: ${chalk.blue(
          globalInfo.project_name
        )} at domain: ${chalk.green(globalInfo.pages_domain)}`
      )
    );
  }
  const json = await getPagesProjectResponse.json();
  console.log(json);
  if (globalInfo.custom_domain) {
    console.log(
      chalk.green(
        `Your Pages Project: ${globalInfo.project_name} is deployed to ${globalInfo.custom_domain}`
      )
    );
  } else {
    console.log(
      "congrats ✨ \n" +
        chalk.green(
          `Your Pages Project: ${globalInfo.project_name} is deployed to ${globalInfo.pages_domain}`
        )
    );
  }
}

async function getCloudflarePagesProjectInfo() {
  const spinner = ora({
    text: `Checking ownership of Cloudflare Pages Project: ${globalInfo.project_name}`,
    color: "yellow",
  });
  let url = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/pages/projects/${globalInfo.project_name}`;
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },
  };
  const getPagesProjectResponse = await fetch(url, options);
  spinner.stop();
  if (!getPagesProjectResponse.ok) {
    console.log(
      chalk.red(
        `There was an issue checking ownership of your Cloudflare Pages Project: ${globalInfo.project_name}`
      )
    );
    const continueSelect = await select({
      message: `Do you want to continue?`,
      choices: [
        {
          name: "🆕 Create new project with a different name",
          value: "createNew",
        },
        {
          name: "🚪 Exit",
          value: "exit",
        },
      ],
    });
    if (continueSelect === "createNew") {
      globalInfo.name = await input({
        message: "Enter the name of your project:",
        default: globalInfo.name + "-2",
      });
      await createCloudFlarePagesProject();
      return;
    } else if (continueSelect === "exit") {
      console.log(chalk.red("Exiting..."));
      process.exit(1);
    }
  }
  const getPagesProjectInfo = await getPagesProjectResponse.json();
  console.log(
    chalk.green(`Using Cloudflare Pages Project: ${globalInfo.name}`)
  );
}

async function createCloudFlarePagesProject() {
  const spinner = ora({
    text: `Creating Cloudflare Pages Project`,
    color: "yellow",
  }).start();
  const createPagesProjectURL = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/pages/projects`;

  let options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },

    body: JSON.stringify({
      build_config: {},
      canonical_deployment: {},
      deployment_configs: {
        preview: {},
        production: {
          compatibility_date: "2023-10-11",
          d1_databases:
            globalInfo.D1_DATABSE_ID && globalInfo.D1
              ? {
                  DB: { id: globalInfo.D1_DATABSE_ID },
                }
              : {},
          env_vars: {
            SUPABASE_URL: {
              type: "plain_text",
              value: globalInfo.SUPABASE_URL,
            },
            SUPABASE_ANON_KEY: {
              type: "plain_text",
              value: globalInfo.SUPABASE_ANON_KEY,
            },
            R2_PUBLIC_URL: {
              type: "plain_text",
              value: globalInfo.R2_PUBLIC_URL,
            },
          },
          r2_buckets:
            globalInfo.R2_BUCKET_NAME && globalInfo.R2
              ? { R2_BUCKET: { name: globalInfo.R2_BUCKET_NAME } }
              : {},
        },
      },
      latest_deployment: {},
      name: globalInfo.name,
      production_branch: "main",
    }),
  };

  const createPagesProjectResponse = await fetch(
    createPagesProjectURL,
    options
  );
  spinner.stop();
  if (!createPagesProjectResponse.ok) {
    if (createPagesProjectResponse.status === 409) {
      const options = [
        {
          name: "🔄 Use existing project",
          value: "useExisting",
        },
        {
          name: "🆕 Create new project with a different name",
          value: "createNew",
        },
        {
          name: "🚪 Exit",
          value: "exit",
        },
      ];
      const choice = await select({
        message:
          "A project with that name already exists, what do you want to do?",
        choices: options,
      });

      if (choice === "useExisting") {
        console.log(
          chalk.green(
            `Using existing Cloudflare Pages project: ${globalInfo.name}`
          )
        );
        return;
      } else if (choice === "createNew") {
        globalInfo.name = await input({
          message: "Enter the name of your project:",
          default: "n4-stack-2",
        });
        await createCloudFlarePagesProject();
        return;
      } else if (choice === "exit") {
        console.log(chalk.red("Exiting..."));
        process.exit(1);
      }
    }
    chalk.red(
      "There was an error creating your Cloudflare Pages project: " +
        createPagesProjectResponse.statusText
    );
    process.exit(1);
  }
  const createPagesProjectInfo = await createPagesProjectResponse.json();

  globalInfo.pages_domain = createPagesProjectInfo.result.subdomain;
  globalInfo.project_name = createPagesProjectInfo.result.name;
  // great console chalk about project created
  console.log(
    chalk.green(
      `Created Cloudflare Pages Project: ${globalInfo.name} at ${globalInfo.pages_domain}.pages.dev`
    )
  );
}

/** 
1. Ask user for the name of the project and the destination path
2. Clone the N4 Pages repo from Github
 */
async function copyN4FilesFromGit() {
  const repoUrl = "https://github.com/nicholasoxford/n4-pages.git";

  await cloneRepository(repoUrl, globalInfo.destination).catch((error) =>
    console.error("Failed to clone repository:", error)
  );
}
/**
 Based on previous choice, update the project files
 */
async function updateProjectFiles() {
  await updatePackageJson();
  await createLocalDotEnv();
  await updateWranglerConfig();
  await updateRemixEnvConfig();
  await updateSiteConfig();
}

async function installDependencies() {
  const spinner = ora({
    text: `Installing dependencies`,
    color: "yellow",
  }).start();
  const installDependenciesCmd = spawn("npm", ["install"], {
    cwd: globalInfo.destination,
  });

  // Capture the response from stdout
  await execAsync(installDependenciesCmd);
  spinner.stop();
  console.log(chalk.green("✅ Dependencies installed successfully"));
}

/**
 * @description Grabs the  API key from the user if not passed in
 */
async function grabAPIKey() {
  // Grab Cloudflare API key if not passed in
  if (!globalInfo.api_key) {
    globalInfo.api_key = await input({
      message: "Enter the API Key associated with your Cloudflare account:",
    });
  }
}

/**
 * @description Verifies the Cloudflare account exist
 */
async function verifyAccount() {
  const authSpinner = ora({
    text: `Checking Cloudflare Resources`,
    color: "yellow",
  }).start();
  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },
  };
  const verifyUrl = `https://api.cloudflare.com/client/v4/user/tokens/verify`;
  try {
    const verify = await fetch(verifyUrl, options);
    if (!verify.ok) {
      throw new Error(`HTTP error! Status: ${verify.status}`);
    }
    const data = await verify.json();
    if (!data) {
      throw new Error("No data received from Cloudflare account verification");
    }
  } catch (err: any) {
    throw new Error(
      "There was an error checking your Cloudflare account: " + err.message
    );
  }

  authSpinner.stop();
  console.log(
    chalk.green(`Cloudflare account ${chalk.greenBright("verified")}`)
  );
}

/**
 * @description Fetches the potential Cloudflare accounts associated with the API key
 */
async function fetchPotentialAccounts(): Promise<AccountInfo[]> {
  const spinner = ora({
    text: `Checking Cloudflare Accounts`,
    color: "yellow",
  }).start();

  const GRAB_ACCOUNTS_URL = "https://api.cloudflare.com/client/v4/accounts";
  let potentialAccounts: AccountInfo[] = [];
  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },
  };
  const responseInfo = await fetch(GRAB_ACCOUNTS_URL, options);
  spinner.stop();
  if (!responseInfo.ok) {
    throw new Error(`HTTP error! Status: ${responseInfo.status}`);
  }

  const json: AccountInfoResponse = await responseInfo.json();
  if (json.success && json.result) {
    json.result.forEach((account) => {
      potentialAccounts.push(account);
    });
  } else {
    throw new Error("No accounts found or an error occurred");
  }

  return potentialAccounts;
}

/**
 * @description Selects the Cloudflare account to use
 * @param potentialAccounts
 */
async function selectAccount(potentialAccounts: AccountInfo[]): Promise<void> {
  if (potentialAccounts.length === 0) {
    console.error(
      chalk.red("No Cloudflare accounts associated with this API key")
    );
    process.exit(1);
  } else if (potentialAccounts.length === 1) {
    const confirmResp = await confirm({
      message: `Do you want to use your ${chalk.green(
        potentialAccounts[0]?.name
      )} Cloudflare account?`,
      default: true,
    });
    if (!confirmResp) {
      console.error(
        chalk.red("There are no other accounts associated with this API key")
      );
      process.exit(1);
    }
    console.log(
      chalk.green(
        `Using Cloudflare account: ${chalk.greenBright(
          potentialAccounts[0]?.name
        )}`
      )
    );
    if (potentialAccounts[0]?.id)
      globalInfo.account_id = potentialAccounts[0].id;
  } else if (potentialAccounts.length > 1) {
    const account_id = await select({
      message: "Select the account you want to use:",
      choices: potentialAccounts.map((account) => ({
        title: account.name,
        value: account.id,
      })),
    });
    globalInfo.account_id = account_id;
    // grab name
    const account_name = potentialAccounts.find(
      (account) => account.id === account_id
    )?.name;
    console.log(
      chalk.green(
        `Using Cloudflare account: ${chalk.greenBright(account_name)}`
      )
    );
  }
}

/**
 * @description Grabs the R2 Bucket info for the account
 */
async function grabR2BucketInfo() {
  if (!globalInfo.TOP_LEVEL_DOMAIN_ID) {
    const confirmContinueWithoutDomain = await confirm({
      message: `We advise against using an R2 bucket without a custom domain. Would you like to proceed with deploying an R2 Bucket anyway?`,
      default: false,
    });

    if (!confirmContinueWithoutDomain) {
      return;
    }
  }

  const spinner = ora({
    text: `Checking R2 Buckets`,
    color: "yellow",
  }).start();

  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },
  };
  const r2_info_url = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/r2/buckets`;
  const r2InfoResponse = await fetch(r2_info_url, options);
  if (!r2InfoResponse.ok) {
    chalk.red(
      "There was an error checking your Cloudflare account: " + r2InfoResponse
    );
    process.exit(1);
  }
  const r2Info = await r2InfoResponse.json();
  let buckets: {
    name: string;
    creation_date: string;
  }[] = [];
  if (r2Info.success && r2Info.result) {
    buckets = r2Info.result.buckets;
  }
  spinner.stop();
  if (buckets.length === 0) {
    // ask the user if they want to create a bucket
    const createBucket = await confirm({
      message: `No R2 buckets are linked to your Cloudflare account. Would you like to create one for this project?`,
      default: false,
    });
    if (createBucket) {
      await createR2Bucket();
    }
  } else {
    // instead of a confirm, use a select and give one option as createNewBucket, or don't use R2 bucket
    const bucketSelectInfo = buckets
      .map((bucket) => ({
        name: bucket.name,
        value: bucket.name,
      }))
      .concat(
        {
          name: "🆕 Create a New R2 Bucket",
          value: "createNewBucket",
        },
        {
          name: "🚫 Don't Use an R2 Bucket for This Project",
          value: "none",
        }
      );

    const bucket_id = await select({
      message: "Select the bucket you want to use:",
      choices: bucketSelectInfo,
    });
    if (bucket_id === "createNewBucket") {
      await createR2Bucket();
      return;
    } else if (bucket_id === "none") {
      console.log(chalk.green("Continuing without an R2 bucket 🪣"));
      return;
    }
    globalInfo.R2_BUCKET_NAME = bucket_id;
    console.log(chalk.green(`Using R2 Bucket: ${bucket_id}`));
    if (globalInfo.TOP_LEVEL_DOMAIN) {
      await checkZoneDNSListForR2BucketRecord();
    }
  }
}

async function checkZoneDNSListForR2BucketRecord() {
  const spinner = ora({
    text: `Checking if there is a public URL for your R2 Bucket and domain: ${chalk.greenBright(
      globalInfo.TOP_LEVEL_DOMAIN
    )}`,
    color: "yellow",
  }).start();

  let url = `https://api.cloudflare.com/client/v4/zones/${globalInfo.TOP_LEVEL_DOMAIN_ID}/dns_records?content=public.r2.dev`;
  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },
  };

  const t = await fetch(url, options);
  if (!t.ok) {
    console.log(
      chalk.yellow(
        "You api key did not have sufficient permissions to check DNS records"
      )
    );
  }
  const json = await t.json();
  spinner.stop();
  if (json.result?.length === 0) {
    const existingPublicUrlConfirm = await confirm({
      message: `We found no public access URL associated with your R2 Bucket and domain: ${chalk.blue(
        globalInfo.TOP_LEVEL_DOMAIN
      )}, does your R2 bucket have a public url associated with another domain?`,
      default: true,
    });

    if (existingPublicUrlConfirm) {
      globalInfo.R2_PUBLIC_URL = await input({
        message: "Enter the public URL for your R2 Bucket:",
      });
    } else {
      const continueWithNoPublicUrl = await confirm({
        message: `Do you want to continue without a public URL for your existing R2 Bucket? You can create one in the Cloudflare dashboard later.`,
        default: true,
      });
      if (!continueWithNoPublicUrl) {
        console.log(chalk.red("Exiting..."));
        process.exit(1);
      }
    }
  }
  if (json.result?.length === 1) {
    const url = json.result[0].name;
    const existingPublicUrlConfirm = await confirm({
      message: `We found the domain: ${chalk.green(
        url
      )} associated with your R2 Bucket and domain: ${chalk.blue(
        globalInfo.TOP_LEVEL_DOMAIN
      )}, do you want to use this in your project?`,
      default: true,
    });
    if (existingPublicUrlConfirm) {
      globalInfo.R2_PUBLIC_URL = url;
    } else {
      const confirmExistingPublicUrl = await confirm({
        message: `Do you have another public URL for your R2 Bucket: ${url}?`,
      });

      if (confirmExistingPublicUrl) {
        globalInfo.R2_PUBLIC_URL = await input({
          message: "Enter the public URL for your R2 Bucket:",
        });
      }
      const continueWithNoPublicUrl = await confirm({
        message: `Do you want to continue without a public URL for your existing R2 Bucket? You can create one in the Cloudflare dashboard later.`,
        default: true,
      });
      if (!continueWithNoPublicUrl) {
        console.log(chalk.red("Exiting..."));
        process.exit(1);
      }
    }
  }
  if (globalInfo.R2_PUBLIC_URL) {
    console.log(
      chalk.green(`Using R2 Public URL: ${globalInfo.R2_PUBLIC_URL}`)
    );
  }
}

async function grabZonesSelectURL() {
  const spinner = ora({
    text: `Checking Cloudflare Zones`,
    color: "yellow",
  }).start();

  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`, // Updated to use Bearer token
    },
  };
  const zone_info_url = `https://api.cloudflare.com/client/v4/zones?account.id=${globalInfo.account_id}`;
  const zoneInfoResponse = await fetch(zone_info_url, options);
  if (!zoneInfoResponse.ok) {
    chalk.red(
      "There was an error checking your Cloudflare account: " + zoneInfoResponse
    );
    process.exit(1);
  }
  const r2Info = await zoneInfoResponse.json();
  spinner.stop();
  if (!r2Info.success || !r2Info.result) {
    console.log(chalk.red("No zones found or an error occurred"));
  }
  if (r2Info.result_info.total_count === 0) {
    const continueResp = await confirm({
      message: `We found no domains associated with your Cloudflare account, if you need an R2 bucket, you will need to do extra steps to make it publicly accessible. Do you want to continue?`,
      default: false,
    });
    if (!continueResp) {
      console.log(chalk.red("Exiting..."));
      process.exit(1);
    }
    console.log(
      chalk.green(
        "Continuing without a domain, one will be created for you when you deploy pages"
      )
    );
  } else {
    let domainInfoArray: SelectInfo[] = [];
    r2Info.result
      .filter((z: any) => z.type === "full")
      .forEach((zone: any) => {
        domainInfoArray.push({
          name: zone.name,
          value: zone.name,
        });
      });

    domainInfoArray.push({
      name: "❌ Don't use a domain for this project",
      value: "none",
    });

    globalInfo.TOP_LEVEL_DOMAIN = await select({
      message: "Select the domain you want to use:",
      choices: domainInfoArray,
    });

    if (globalInfo.TOP_LEVEL_DOMAIN === "none") {
      console.log(
        chalk.green(
          "Continuing without a domain, one will be created for you when you deploy pages"
        )
      );
      return;
    }

    globalInfo.TOP_LEVEL_DOMAIN_ID = r2Info.result.find(
      (z: any) => z.name === globalInfo.TOP_LEVEL_DOMAIN
    ).id;

    console.log(
      chalk.green(
        `Using top level domain: ${chalk.greenBright(
          globalInfo.TOP_LEVEL_DOMAIN
        )}, you can chose a subdomain later`
      )
    );
  }
}

async function createR2Bucket() {
  const r2BucketName = await input({
    message: "Enter the name of your R2 Bucket:",
    default: `${globalInfo.name}-database`,
  });

  let url = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/r2/buckets`;

  let options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`,
    },
    body: JSON.stringify({
      name: r2BucketName,
    }),
  };

  const createR2Response = await fetch(url, options);
  if (!createR2Response.ok) {
    chalk.red(
      "There was an error checking your Cloudflare account: " + createR2Response
    );
    process.exit(1);
  }
  const createR2Info = await createR2Response.json();
  globalInfo.R2_BUCKET_NAME = createR2Info.result.name;
  console.log(chalk.green(`Created and using R2 Bucket: ${r2BucketName}`));
}

async function checkForPreExistingD1Databases() {
  let url = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/d1/database`;

  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`,
    },
  };

  const d1DatabaseResponse = await fetch(url, options);
  if (!d1DatabaseResponse.ok) {
    chalk.red(
      "There was an error checking your Cloudflare account: " +
        d1DatabaseResponse
    );
    process.exit(1);
  }
  const d1DatabaseInfo = await d1DatabaseResponse.json();
  if (d1DatabaseInfo.result.length === 0) {
    const createD1DatabaseConfirm = await confirm({
      message: `We found no D1 Databases associated with your Cloudflare account, do you want to create one for this project? (recommended)`,
      default: true,
    });
    if (createD1DatabaseConfirm) {
      await createD1Database();
    }
  }
  if (d1DatabaseInfo.result.length > 0) {
    const choices: { name: string; value: string }[] =
      d1DatabaseInfo.result.map((d1Database: any) => ({
        name: d1Database.name,
        value: d1Database.uuid,
      }));
    choices.push({
      name: "Create a new D1 Database (recommended)",
      value: "createNewDatabase",
    });
    choices.reverse();
    choices.push({
      name: "🚫 Don't Use a D1 Database for This Project",
      value: "none",
    });
    const d1Database_id = await select({
      message: "Choose an option for your D1 Database:",
      choices,
    });
    if (d1Database_id === "createNewDatabase") {
      await createD1Database();
      return;
    } else if (d1Database_id === "none") {
      console.log(chalk.green("Continuing without a D1 Database 🪣"));
      return;
    }
    // Set name and ID
    globalInfo.D1_DATABSE_NAME = d1DatabaseInfo.result.find(
      (d1Database: any) => d1Database.uuid === d1Database_id
    ).name;
    globalInfo.D1_DATABSE_ID = d1Database_id;

    console.log(
      chalk.green(`Using D1 Database: ${globalInfo.D1_DATABSE_NAME}`)
    );
  }
}

async function createD1Database() {
  const nameOfDatabase = await input({
    message: "Enter the name of your D1 Database:",
    default: "n4-stack-database",
  });
  const spinner = ora({
    text: `Creating D1 Database`,
    color: "yellow",
  }).start();
  let url = `https://api.cloudflare.com/client/v4/accounts/${globalInfo.account_id}/d1/database`;

  let options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${globalInfo.api_key}`,
    },
    body: JSON.stringify({
      name: nameOfDatabase,
    }),
  };
  const createD1DatabaseResponse = await fetch(url, options).catch((err) => {
    chalk.red(
      "There was an error checking your Cloudflare account: " + err.message
    );
    process.exit(1);
  });

  spinner.stop();
  if (!createD1DatabaseResponse.ok) {
    console.log(
      chalk.red(
        "There was an error creating your D1 Database... Check if the name is already taken"
      )
    );
    process.exit(1);
  }

  const createD1DatabaseInfo = await createD1DatabaseResponse.json();
  globalInfo.D1_DATABSE_ID = createD1DatabaseInfo.result.uuid;
  globalInfo.D1_DATABSE_NAME = createD1DatabaseInfo.result.name;
  console.log(chalk.green(`Created and using D1 Database: ${nameOfDatabase}`));
}

/**
 * @description Simple function to check if the Supabase URL and Key are valid
 */
async function grabSupabaseInfo() {
  const authSpinner = ora({
    text: `Checking Supabase Resources`,
    color: "yellow",
  }).start();
  const url = `${globalInfo.SUPABASE_URL}/rest/v1/`;

  const options = {
    method: "GET",
    headers: {
      apikey: globalInfo.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${globalInfo.SUPABASE_ANON_KEY}`,
    },
  };
  const supabaseInfo = await fetch(url, options);
  authSpinner.stop();
  if (!supabaseInfo.ok) {
    console.log(
      chalk.red("There was an error verifying your Supabase account")
    );
    process.exit(1);
  }
}

/**
 * @description Clones the N4 Pages repo from Github
 * @param repoUrl
 * @param destination
 */
async function cloneRepository(
  repoUrl: string,
  destination: string
): Promise<void> {
  const spinner = ora({
    text: `Cloning repository from ${repoUrl}`,
    color: "yellow",
  }).start();
  const gitClone = spawn("git", ["clone", repoUrl, destination]);

  // Capture the response from stdout
  await execAsync(gitClone);
  spinner.stop();
  console.log(chalk.green("✅ Repository cloned successfully"));
}

/**
 * @description Updates the package.json file with the options the user has chosen or passed in
 */
async function updatePackageJson() {
  const spinner = ora({
    text: `Updating project files`,
    color: "yellow",
  }).start();
  const packageJsonPath = `${globalInfo.destination}/package.json`;
  try {
    // Read the package.json file
    const data = await promises.readFile(packageJsonPath, "utf8");

    // Parse the JSON data
    const packageJson = JSON.parse(data);

    // Update the 'name' field
    packageJson.name = globalInfo.name;

    // Convert the object back to a JSON string
    const updatedPackageJson = JSON.stringify(packageJson, null, 2);

    // Write the changes back to the package.json file
    await promises.writeFile(packageJsonPath, updatedPackageJson, "utf8");
    spinner.stop();
    console.log(chalk.green("✅ package.json updated successfully"));
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

async function createLocalDotEnv() {
  const spinner = ora({
    text: `Updating local dotenv file`,
    color: "yellow",
  }).start();

  let devVars = `SUPABASE_URL="${globalInfo.SUPABASE_URL}"
SUPABASE_ANON_KEY="${globalInfo.SUPABASE_ANON_KEY}"`;

  if (globalInfo.R2 && globalInfo.R2_PUBLIC_URL) {
    devVars += `\nR2_PUBLIC_URL="${globalInfo.R2_PUBLIC_URL}"`;
  }
  try {
    // Write the changes back to the package.json file
    await promises.writeFile(
      `${globalInfo.destination}/.dev.vars`,
      devVars,
      "utf8"
    );
    spinner.stop();
    console.log(chalk.green("✅ Created .dev.vars file successfully"));
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

async function updateWranglerConfig() {
  const filePath = `${globalInfo.destination}/wrangler.toml`;
  const spinner = ora({
    text: `Updating wrangler.toml file`,
    color: "yellow",
  }).start();

  try {
    // Read the content of the wrangler.toml file
    let configContent = await promises.readFile(filePath, "utf8");
    if (globalInfo.D1 && globalInfo.D1_DATABSE_ID) {
      // Replace placeholders with actual values
      configContent = configContent.replace(
        "DATABASE_NAME_REPLACE",
        globalInfo.D1_DATABSE_NAME
      );
      configContent = configContent.replace(
        "DATABASE_ID_REPLACE",
        globalInfo.D1_DATABSE_ID
      );
    } else {
      // Remove all lines in the file
      configContent = "";
    }
    // Write the updated content back to the wrangler.toml file
    await promises.writeFile(filePath, configContent, "utf8");
    spinner.stop();
    console.log(chalk.green("✅ Updated wrangler.toml file successfully"));
  } catch (error) {
    spinner.stop();
    console.error(
      chalk.red("Error occurred while updating the wrangler.toml file:"),
      error
    );
    process.exit(1);
  }
}

async function updateRemixEnvConfig() {
  const filePath = `${globalInfo.destination}/remix.env.d.ts`;
  const spinner = ora({
    text: `Updating remix.env.d.ts file`,
    color: "yellow",
  }).start();

  try {
    // Read the content of the remix.env.d.ts file
    let configContent = await promises.readFile(filePath, "utf8");

    if (!globalInfo.R2) {
      // Remove the lines related to R2_BUCKET and R2_PUBLIC_URL
      const r2BucketRegex = /R2_BUCKET: R2Bucket;\s*/;
      const r2PublicUrlRegex = /R2_PUBLIC_URL: string;\s*/;
      configContent = configContent.replace(r2BucketRegex, "");
      configContent = configContent.replace(r2PublicUrlRegex, "");
    }

    // Write the updated content back to the remix.env.d.ts file
    await promises.writeFile(filePath, configContent, "utf8");
    spinner.stop();
    console.log(chalk.green("✅ Updated remix.env.d.ts file successfully"));
  } catch (error) {
    spinner.stop();
    console.error(
      chalk.red("Error occurred while updating the remix.env.d.ts file:"),
      error
    );
  }
}

async function updateSiteConfig() {
  const filePath = `${globalInfo.destination}/app/config/site.ts`;
  const spinner = ora({
    text: `Updating site.ts file`,
    color: "yellow",
  }).start();

  try {
    // Read the content of the site.ts file
    let configContent = await promises.readFile(filePath, "utf8");

    // Replace the placeholder with the actual package name
    configContent = configContent.replace(
      "PACKAGE_NAME_REPLACE",
      globalInfo.name
    );

    // Write the updated content back to the site.ts file
    await promises.writeFile(filePath, configContent, "utf8");
    spinner.stop();
    console.log(chalk.green("✅ Updated site.ts file successfully"));
  } catch (error) {
    spinner.stop();
    console.error(
      chalk.red("Error occurred while updating the site.ts file:"),
      error
    );
  }
}

/**
 * @description Executes a child process and returns the response from stdout
 * @param spawn
 */
async function execAsync(spawn: ChildProcessWithoutNullStreams) {
  let response = "";
  spawn.on("error", (err) => {
    console.log(`error: ${err.message}`);
  });

  spawn.stderr.on("error", (data) => {
    console.log(`stderr: ${data}`);
  });

  spawn.on("error", (err) => {
    console.error(`error: ${err.message}`);
    throw err; // Throw the error to propagate it to the caller
  });

  for await (const data of spawn.stdout) {
    response += data.toString();
  }
  return response;
}

function ensureURLProtocol(url: string) {
  // Regular expression to check if the URL starts with a protocol
  const protocolRegex = /^[a-zA-Z]+:\/\//;
  // Regular expression to check if the URL starts with 'www.'
  const wwwRegex = /^www\./;

  // If the URL does not start with a protocol
  if (!protocolRegex.test(url)) {
    // If the URL starts with 'www.', prepend 'http://'
    if (wwwRegex.test(url)) {
      url = "http://" + url;
    } else {
      // If the URL doesn't start with 'www.', you can decide whether to prepend 'http://', 'https://', or something else
      url = "http://" + url; // Or 'https://' based on your requirement
    }
  }

  return url;
}

interface AccountInfo {
  id: string;
  name: string;
}
interface SelectInfo {
  value: string;
  name: string;
}

interface AccountInfoResponse {
  result: AccountInfo[];
  success: boolean;
  errors: any[];
  messages: any[];
}

type GlobalInfo = {
  D1: boolean;
  R2: boolean;
  name: string;
  api_key: string;
  account_id: string;
  destination: string;
  project_name: string;
  pages_domain: string;
  custom_domain: string;
  TOP_LEVEL_DOMAIN: string;
  TOP_LEVEL_DOMAIN_ID: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  R2_PUBLIC_URL: string;
  R2_BUCKET_NAME: string;
  D1_DATABSE_ID: string;
  D1_DATABSE_NAME: string;
};
