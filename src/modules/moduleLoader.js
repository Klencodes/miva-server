/**
 * moduleLoader.js
 * Safely loads route modules so one broken module never crashes the server.
 * Each module is wrapped in a try/catch — if it throws on require(), we log
 * the error and skip that route rather than bringing down the whole process.
 */

const MODULE_REGISTRY = [
  { name: 'Auth',         path: '../routes/Auth',         mountPath: '/api/auth'          },
  { name: 'Gmail',        path: '../routes/Gmail',        mountPath: '/api/gmail'         },
  { name: 'ActivityLogs', path: '../routes/ActivityLogs', mountPath: '/api/activity-logs' },
  { name: 'Entity',       path: '../routes/Entity',       mountPath: '/api/entities'      },
  { name: 'Inventory',    path: '../routes/Inventory',    mountPath: '/api/inventory'     },
  { name: 'Invoice',      path: '../routes/Invoice',      mountPath: '/api/invoices'      },
  { name: 'User',         path: '../routes/User',         mountPath: '/api/users'         },
  { name: 'Dashboard',    path: '../routes/Dashboard',    mountPath: '/api/dashboard'     },
  { name: 'Customer',     path: '../routes/Customer',     mountPath: '/api/customers'     },
  { name: 'Supplier',     path: '../routes/Supplier',     mountPath: '/api/suppliers'     },
  { name: 'Expense',      path: '../routes/Expense',      mountPath: '/api/expenses'      },
];

/**
 * Loads all modules and mounts them onto the Express app.
 * Returns a status map so the health check can report which modules are up.
 *
 * @param {import('express').Application} app
 * @returns {{ loaded: string[], failed: Record<string, string> }}
 */
function loadModules(app) {
  const loaded = [];
  const failed = {};

  for (const mod of MODULE_REGISTRY) {
    try {
      const router = require(mod.path);

      // Sanity-check: make sure we got something Express can mount
      if (typeof router !== 'function' && typeof router !== 'object') {
        throw new Error(`Module "${mod.name}" did not export a valid router`);
      }

      app.use(mod.mountPath, router);
      loaded.push(mod.name);
      console.log(`✅ Module loaded: ${mod.name} → ${mod.mountPath}`);
    } catch (err) {
      failed[mod.name] = err.message;
      console.error(`❌ Module failed to load: ${mod.name} (${mod.mountPath})`);
      console.error(`   Reason: ${err.message}`);

      // Mount a fallback that returns 503 for every request to this path
      app.use(mod.mountPath, (req, res) => {
        res.status(503).json({
          error:   'Module unavailable',
          module:  mod.name,
          reason:  err.message,
          message: `The ${mod.name} module failed to initialise and is temporarily unavailable.`,
        });
      });
    }
  }

  const total = MODULE_REGISTRY.length;
  console.log(`\n📦 Modules: ${loaded.length}/${total} loaded, ${Object.keys(failed).length} failed\n`);

  return { loaded, failed };
}

module.exports = { loadModules, MODULE_REGISTRY };