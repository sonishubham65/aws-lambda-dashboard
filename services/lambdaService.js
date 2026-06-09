const AWS = require("aws-sdk");
const { formatDateWithSeconds, formatDate } = require("../utils/dateUtils");
const { getEnvironment } = require("../utils/lambdaUtils");

if (process.env.AWS_EXECUTION_ENV === undefined) {
  AWS.config.credentials = new AWS.SharedIniFileCredentials({
    profile: "shubham",
  });
}

function getLambdaClient(region) {
  return new AWS.Lambda({
    region,
  });
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedFunctions = null;
let cacheTimestamp = 0;
let refreshInProgress = null;

const EXCLUDED_LAMBDAS = [
  "ecom-test",
  "ecom-delete-me",
  "ecom-service-catalog",
];

const INCLUDED_LAMBDAS = [
  "wallet-service",
  "streak-service",
  "product-service",
  "cart-service",
  "test-20",
  "cart-dev-service"
];
const cache = new Map();

async function getLambdaFunctions(region = "ap-south-1", forceRefresh = false) {
  const cached = cache.get(region);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await loadLambdaFunctions(region);

  cache.set(region, {
    data,
    timestamp: Date.now(),
  });

  return data;
}

async function loadLambdaFunctions(region) {
  let functions = [];
  let Marker;
  const lambda = getLambdaClient(region);

  do {
    const response = await lambda.listFunctions({ Marker }).promise();

    functions = functions.concat(response.Functions);

    Marker = response.NextMarker;
  } while (Marker);

  const filtered = functions.filter((fn) => {
    const name = fn.FunctionName;

    if (EXCLUDED_LAMBDAS.includes(name)) {
      return false;
    }

    return name.startsWith("ecom") || INCLUDED_LAMBDAS.includes(name);
  });

  return Promise.all(
    filtered.map(async (fn) => {
      try {
        const config = await lambda
          .getFunctionConfiguration({
            FunctionName: fn.FunctionName,
          })
          .promise();

        const metadata = JSON.parse(
          config.Environment?.Variables?.SERVICE_METADATA || "{}",
        );

        const concurrency = await lambda
          .getFunctionConcurrency({
            FunctionName: fn.FunctionName,
          })
          .promise();

        reservedConcurrency =
          concurrency.ReservedConcurrentExecutions || "Unreserved";

        return {
          name: fn.FunctionName,
          runtime: fn.Runtime,
          region,
          memorySize: config.MemorySize,
          version: config.Version,
          ephemeralStorage: config.EphemeralStorage?.Size || 512,
          architecture: config.Architectures?.join(", "),
          packageType: config.PackageType,
          state: config.State,
          lastUpdateStatus: config.LastUpdateStatus,
          layers: config.Layers?.map((layer) => layer.Arn) || [],
          vpcEnabled: !!config.VpcConfig?.VpcId,
          stateReason: config.StateReason,
          timeout: config.Timeout,
          handler: config.Handler,
          lastModified: formatDate(fn.LastModified),
          environment: getEnvironment(fn.FunctionName),
          arn: fn.FunctionArn,
          metadata: {
            ...metadata,
            buildTime: formatDate(metadata.buildTime),
          },
        };
      } catch (err) {
        console.error(`Failed to load ${fn.FunctionName}`, err.message);
        return {
          name: fn.FunctionName,
          runtime: fn.Runtime,
          lastModified: fn.LastModified,
          arn: fn.FunctionArn,
        };
      }
    }),
  );
}
function clearCache() {
  cachedFunctions = null;
  cacheTimestamp = 0;
}
module.exports = {
  getLambdaFunctions,
  clearCache,
};
