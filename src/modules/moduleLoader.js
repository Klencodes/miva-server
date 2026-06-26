const path = require('path');

// Get the absolute path to the routes directory
// Assuming moduleLoader.js is in src/modules/ and routes are in src/routes/
const ROUTES_DIR = path.join(__dirname, '..', 'routes');
const MODULE_REGISTRY = [
  { name: 'Auth',         path: path.join(ROUTES_DIR, 'Auth'),         mountPath: '/api/auth'          },
  { name: 'Gmail',        path: path.join(ROUTES_DIR, 'Gmail'),        mountPath: '/api/gmail'         },
  { name: 'ActivityLogs', path: path.join(ROUTES_DIR, 'ActivityLogs'), mountPath: '/api/activity-logs' },
  { name: 'Entity',       path: path.join(ROUTES_DIR, 'Entity'),       mountPath: '/api/entities'      },
  { name: 'Inventory',    path: path.join(ROUTES_DIR, 'Inventory'),    mountPath: '/api/inventory'     },
  { name: 'Invoice',      path: path.join(ROUTES_DIR, 'Invoice'),      mountPath: '/api/invoices'      },
  { name: 'User',         path: path.join(ROUTES_DIR, 'User'),         mountPath: '/api/users'         },
  { name: 'Dashboard',    path: path.join(ROUTES_DIR, 'Dashboard'),    mountPath: '/api/dashboard'     },
  { name: 'Customer',     path: path.join(ROUTES_DIR, 'Customer'),     mountPath: '/api/customers'     },
  { name: 'Supplier',     path: path.join(ROUTES_DIR, 'Supplier'),     mountPath: '/api/suppliers'     },
  { name: 'Expense',      path: path.join(ROUTES_DIR, 'Expense'),      mountPath: '/api/expenses'      },
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
      // Check if the file exists before requiring
      try {
        require.resolve(mod.path);
      } catch (resolveErr) {
        // Try with .js extension
        try {
          require.resolve(mod.path + '.js');
        } catch (resolveErr2) {
          throw new Error(`Route file not found: ${mod.path}.js - Check if the file exists and has the correct name`);
        }
      }

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