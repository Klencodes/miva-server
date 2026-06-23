// controllers/invoiceController.js
const InvoiceService = require('../services/Invoice');
const { getCurrentEntity } = require('../middleware/auth');

class InvoiceController {
  /**
   * GET /api/invoices
   * Get all invoices with pagination and filtering
   */
  getInvoices = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { 
        page = 1, 
        limit = 10, 
        search, 
        status, 
        date_from, 
        date_to, 
        customer, 
        min_total, 
        max_total 
      } = req.query;

      const result = await InvoiceService.getInvoices(
        entityId,
        { search, status, date_from, date_to, customer, min_total, max_total },
        parseInt(page),
        parseInt(limit)
      );

      return res.json({
        message: "Invoices retrieved successfully",
        code: "INVOICES_FETCH_SUCCESS",
        success: true,
        results: result
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/invoices/:uuid
   * Get invoice by UUID
   */
  getInvoice = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);

      const invoice = await InvoiceService.getInvoiceByUuid(entityId, uuid);

      return res.json({
        message: "Invoice retrieved successfully",
        code: "INVOICE_FETCH_SUCCESS",
        success: true,
        results: { invoice }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/invoices/number/:number
   * Get invoice by invoice number
   */
  getInvoiceByNumber = async (req, res) => {
    try {
      const { number } = req.params;
      const entityId = getCurrentEntity(req);

      const invoice = await InvoiceService.getInvoiceByNumber(entityId, number);

      return res.json({
        message: "Invoice retrieved successfully",
        code: "INVOICE_FETCH_SUCCESS",
        success: true,
        results: { invoice }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/invoices
   * Create a new invoice
   */
  createInvoice = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const invoiceData = req.body;

      const invoice = await InvoiceService.createInvoice(entityId, invoiceData, req);

      return res.json({
        message: "Invoice created successfully",
        code: "INVOICE_CREATED_SUCCESS",
        success: true,
        results: { invoice }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PUT /api/invoices/:uuid
   * Update invoice
   */
  updateInvoice = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);
      const updateData = req.body;

      const invoice = await InvoiceService.updateInvoice(entityId, uuid, updateData, req);

      return res.json({
        message: "Invoice updated successfully",
        code: "INVOICE_UPDATED_SUCCESS",
        success: true,
        results: { invoice }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/invoices/:uuid/payments
   * Add payment to invoice
   */
  addPayment = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);
      const paymentData = req.body;

      const result = await InvoiceService.addPayment(entityId, uuid, paymentData, req);

      return res.json({
        message: "Payment added successfully",
        code: "PAYMENT_ADDED_SUCCESS",
        success: true,
        results: result
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/invoices/:uuid/paid
   * Mark invoice as paid
   */
  markAsPaid = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);

      const invoice = await InvoiceService.markAsPaid(entityId, uuid, req);

      return res.json({
        message: "Invoice marked as paid successfully",
        code: "INVOICE_MARKED_PAID",
        success: true,
        results: { invoice }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/invoices/:uuid/cancel
   * Cancel invoice
   */
  cancelInvoice = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);

      const invoice = await InvoiceService.cancelInvoice(entityId, uuid, req);

      return res.json({
        message: "Invoice cancelled successfully",
        code: "INVOICE_CANCELLED",
        success: true,
        results: { invoice }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/invoices/:uuid
   * Delete invoice (only if draft or cancelled)
   */
  deleteInvoice = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);

      const result = await InvoiceService.deleteInvoice(entityId, uuid, req);

      return res.json({
        message: result.message,
        code: "INVOICE_DELETED_SUCCESS",
        success: true
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/invoices/stats
   * Get invoice statistics
   */
  getInvoiceStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);

      const stats = await InvoiceService.getInvoiceStats(entityId);

      return res.json({
        message: "Invoice statistics retrieved successfully",
        code: "INVOICE_STATS_FETCH_SUCCESS",
        success: true,
        results: stats
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/invoices/export/:uuid
   * Export invoice as PDF (optional)
   */
  exportInvoice = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);
      const { format = 'pdf' } = req.query;

      const invoice = await InvoiceService.getInvoiceByUuid(entityId, uuid);

      // This would call a PDF generation service
      // For now, just return the invoice data
      return res.json({
        message: "Invoice exported successfully",
        code: "INVOICE_EXPORT_SUCCESS",
        success: true,
        results: { 
          invoice,
          format,
          download_url: `/api/invoices/${uuid}/download?format=${format}`
        }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/invoices/customer/:customerId
   * Get invoices by customer
   */
  getInvoicesByCustomer = async (req, res) => {
    try {
      const { customerId } = req.params;
      const entityId = getCurrentEntity(req);
      const { page = 1, limit = 10 } = req.query;

      // This would call a service method to get invoices by customer
      // For now, use the existing getInvoices with customer filter
      const result = await InvoiceService.getInvoices(
        entityId,
        { customer: customerId },
        parseInt(page),
        parseInt(limit)
      );

      return res.json({
        message: "Customer invoices retrieved successfully",
        code: "CUSTOMER_INVOICES_FETCH_SUCCESS",
        success: true,
        results: result
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/invoices/overdue
   * Get overdue invoices
   */
  getOverdueInvoices = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { page = 1, limit = 10 } = req.query;

      // This would call a service method to get overdue invoices
      const result = await InvoiceService.getInvoices(
        entityId,
        { status: 'overdue' },
        parseInt(page),
        parseInt(limit)
      );

      return res.json({
        message: "Overdue invoices retrieved successfully",
        code: "OVERDUE_INVOICES_FETCH_SUCCESS",
        success: true,
        results: result
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/invoices/:uuid/send
   * Send invoice via email
   */
  // In your invoice controller's sendInvoice method
sendInvoice = async (req, res) => {
  try {
    const { uuid } = req.params;
    const entityId = getCurrentEntity(req); // This should return the entity UUID or ObjectId
    
    // If entityId is an ObjectId but your model uses UUID, convert it
    // Or use the entity from the request if available
    const entity = req.entity; // If available from middleware
    
    const { email, message } = req.body;
console.log(entityId, "entityId>>>>>>>>>>>>>>>>>.")
    const result = await InvoiceService.sendInvoice(
      entityId, // Use the UUID instead of ObjectId
      uuid,
      email,
      message,
      req
    );

    return res.json({
      message: "Invoice sent successfully",
      code: "INVOICE_SENT_SUCCESS",
      success: true,
      results: result.results
    });
  } catch (error) {
    return this.handleError(error, res);
  }
};

  /**
   * POST /api/invoices/bulk
   * Bulk create invoices
   */
  bulkCreateInvoices = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { invoices } = req.body;

      if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
        throw new Error('INVOICES_ARRAY_REQUIRED');
      }

      const results = [];
      const errors = [];

      for (const invoiceData of invoices) {
        try {
          const invoice = await InvoiceService.createInvoice(entityId, invoiceData, req);
          results.push(invoice);
        } catch (error) {
          errors.push({
            data: invoiceData,
            error: error.message
          });
        }
      }

      return res.json({
        message: "Bulk invoice creation completed",
        code: "BULK_INVOICE_CREATED",
        success: true,
        results: {
          created: results,
          failed: errors,
          total: invoices.length,
          success_count: results.length,
          failure_count: errors.length
        }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/invoices/next-number
   * Get next invoice number
   */
  getNextInvoiceNumber = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      
      // Get the latest invoice to generate next number
      const latestInvoice = await InvoiceService.getInvoices(
        entityId,
        { limit: 1 },
        1,
        1
      );

      let nextNumber = 'INV-0001';
      
      if (latestInvoice.invoices && latestInvoice.invoices.length > 0) {
        const lastNumber = latestInvoice.invoices[0].number;
        const numPart = parseInt(lastNumber.split('-')[1]) || 0;
        const nextNum = numPart + 1;
        nextNumber = `INV-${String(nextNum).padStart(4, '0')}`;
      }

      return res.json({
        message: "Next invoice number retrieved",
        code: "NEXT_INVOICE_NUMBER_FETCH_SUCCESS",
        success: true,
        results: {
          next_number: nextNumber
        }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Handle errors
   */
  handleError(error, res) {
    console.error('Invoice Controller Error:', error);

    const errorMap = {
      // Validation errors
      'CUSTOMER_NAME_REQUIRED': {
        status: 400,
        message: 'Customer name is required',
        code: 'CUSTOMER_NAME_REQUIRED'
      },
      'ITEMS_REQUIRED': {
        status: 400,
        message: 'At least one item is required',
        code: 'ITEMS_REQUIRED'
      },
      'INVALID_ITEM_DATA': {
        status: 400,
        message: 'Invalid item data: name, price, and quantity are required',
        code: 'INVALID_ITEM_DATA'
      },
      'INVOICES_ARRAY_REQUIRED': {
        status: 400,
        message: 'Invoices array is required for bulk creation',
        code: 'INVOICES_ARRAY_REQUIRED'
      },

      // Not found errors
      'INVOICE_NOT_FOUND': {
        status: 404,
        message: 'Invoice not found',
        code: 'INVOICE_NOT_FOUND'
      },

      // Status errors
      'INVOICE_CANNOT_BE_MODIFIED': {
        status: 400,
        message: 'Paid or cancelled invoices cannot be modified',
        code: 'INVOICE_CANNOT_BE_MODIFIED'
      },
      'INVOICE_CANCELLED': {
        status: 400,
        message: 'This invoice has been cancelled',
        code: 'INVOICE_CANCELLED'
      },
      'INVOICE_ALREADY_PAID': {
        status: 400,
        message: 'This invoice is already paid',
        code: 'INVOICE_ALREADY_PAID'
      },
      'INVOICE_ALREADY_CANCELLED': {
        status: 400,
        message: 'This invoice is already cancelled',
        code: 'INVOICE_ALREADY_CANCELLED'
      },
      'PAID_INVOICE_CANNOT_BE_CANCELLED': {
        status: 400,
        message: 'Paid invoices cannot be cancelled',
        code: 'PAID_INVOICE_CANNOT_BE_CANCELLED'
      },
      'INVOICE_CANNOT_BE_DELETED': {
        status: 400,
        message: 'Only draft or cancelled invoices can be deleted',
        code: 'INVOICE_CANNOT_BE_DELETED'
      },

      // Payment errors
      'INVALID_PAYMENT_AMOUNT': {
        status: 400,
        message: 'Invalid payment amount',
        code: 'INVALID_PAYMENT_AMOUNT'
      },
      'PAYMENT_EXCEEDS_BALANCE': {
        status: 400,
        message: 'Payment amount exceeds remaining balance',
        code: 'PAYMENT_EXCEEDS_BALANCE'
      },

      // Entity errors
      'ENTITY_ID_REQUIRED': {
        status: 400,
        message: 'Entity ID is required',
        code: 'ENTITY_ID_REQUIRED'
      },
      'ENTITY_ACCESS_DENIED': {
        status: 403,
        message: 'You do not have access to this entity',
        code: 'ENTITY_ACCESS_DENIED'
      },
      'NO_ENTITY_AVAILABLE': {
        status: 400,
        message: 'No entity available',
        code: 'NO_ENTITY_AVAILABLE'
      },

      // MongoDB errors
      'MongoServerError': {
        status: 409,
        message: 'Duplicate invoice number',
        code: 'DUPLICATE_INVOICE_NUMBER'
      }
    };

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Invoice number already exists',
        code: 'DUPLICATE_INVOICE_NUMBER',
        success: false
      });
    }

    // Check for validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error: ' + messages.join(', '),
        code: 'VALIDATION_ERROR',
        success: false,
        errors: messages
      });
    }

    const errorConfig = errorMap[error.message] || {
      status: 500,
      message: error.message || 'Internal server error',
      code: 'SERVER_ERROR'
    };

    return res.status(errorConfig.status).json({
      message: errorConfig.message,
      code: errorConfig.code,
      success: false
    });
  }
}

module.exports = new InvoiceController();