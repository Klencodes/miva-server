// controllers/invoiceController.js
const InvoiceService = require('../services/Invoice');
const { getCurrentEntity } = require('../middleware/auth');
const { ApiResponse, ErrorResponse } = require('../utils/response');
const Pagination = require('../utils/pagination');

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

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.invoices,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.invoices,
        "Invoices retrieved successfully",
        pagination
      );
      return res.json(response);
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

      const response = new ApiResponse(invoice, "Invoice retrieved successfully");
      return res.json(response);
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

      const response = new ApiResponse(invoice, "Invoice retrieved successfully");
      return res.json(response);
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

      const response = new ApiResponse(invoice, "Invoice created successfully");
      return res.json(response);
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

      const response = new ApiResponse(invoice, "Invoice updated successfully");
      return res.json(response);
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

      const response = new ApiResponse(result, "Payment added successfully");
      return res.json(response);
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

      const response = new ApiResponse(invoice, "Invoice marked as paid successfully");
      return res.json(response);
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

      const response = new ApiResponse(invoice, "Invoice cancelled successfully");
      return res.json(response);
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

      const response = new ApiResponse(null, result.message);
      return res.json(response);
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

      const response = new ApiResponse(stats, "Invoice statistics retrieved successfully");
      return res.json(response);
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

      const response = new ApiResponse(
        { 
          invoice,
          format,
          download_url: `/api/invoices/${uuid}/download?format=${format}`
        },
        "Invoice exported successfully"
      );
      return res.json(response);
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

      const result = await InvoiceService.getInvoices(
        entityId,
        { customer: customerId },
        parseInt(page),
        parseInt(limit)
      );

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.invoices,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.invoices,
        "Customer invoices retrieved successfully",
        pagination
      );
      return res.json(response);
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

      const result = await InvoiceService.getInvoices(
        entityId,
        { status: 'overdue' },
        parseInt(page),
        parseInt(limit)
      );

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.invoices,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.invoices,
        "Overdue invoices retrieved successfully",
        pagination
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/invoices/:uuid/send
   * Send invoice via email
   */
  sendInvoice = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);
      const entity = req.entity;
      
      const { email, message } = req.body;

      const result = await InvoiceService.sendInvoice(
        entityId,
        uuid,
        email,
        message,
        req
      );

      const response = new ApiResponse(result.results, "Invoice sent successfully");
      return res.json(response);
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
        const error = new Error('INVOICES_ARRAY_REQUIRED');
        error.status = 400;
        throw error;
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

      const response = new ApiResponse(
        {
          created: results,
          failed: errors,
          total: invoices.length,
          success_count: results.length,
          failure_count: errors.length
        },
        "Bulk invoice creation completed"
      );
      return res.json(response);
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
      
      const result = await InvoiceService.getInvoices(
        entityId,
        {},
        1,
        1
      );

      let nextNumber = 'INV-0001';
      
      if (result.invoices && result.invoices.length > 0) {
        const lastNumber = result.invoices[0].number;
        const numPart = parseInt(lastNumber.split('-')[1]) || 0;
        const nextNum = numPart + 1;
        nextNumber = `INV-${String(nextNum).padStart(4, '0')}`;
      }

      const response = new ApiResponse(
        { next_number: nextNumber },
        "Next invoice number retrieved"
      );
      return res.json(response);
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
      'CUSTOMER_NAME_REQUIRED': { status: 400, message: 'Customer name is required' },
      'ITEMS_REQUIRED': { status: 400, message: 'At least one item is required' },
      'INVALID_ITEM_DATA': { status: 400, message: 'Invalid item data: name, price, and quantity are required' },
      'INVOICES_ARRAY_REQUIRED': { status: 400, message: 'Invoices array is required for bulk creation' },
      'INVOICE_NOT_FOUND': { status: 404, message: 'Invoice not found' },
      'INVOICE_CANNOT_BE_MODIFIED': { status: 400, message: 'Paid or cancelled invoices cannot be modified' },
      'INVOICE_CANCELLED': { status: 400, message: 'This invoice has been cancelled' },
      'INVOICE_ALREADY_PAID': { status: 400, message: 'This invoice is already paid' },
      'INVOICE_ALREADY_CANCELLED': { status: 400, message: 'This invoice is already cancelled' },
      'PAID_INVOICE_CANNOT_BE_CANCELLED': { status: 400, message: 'Paid invoices cannot be cancelled' },
      'INVOICE_CANNOT_BE_DELETED': { status: 400, message: 'Only draft or cancelled invoices can be deleted' },
      'INVALID_PAYMENT_AMOUNT': { status: 400, message: 'Invalid payment amount' },
      'PAYMENT_EXCEEDS_BALANCE': { status: 400, message: 'Payment amount exceeds remaining balance' },
      'ENTITY_ID_REQUIRED': { status: 400, message: 'Entity ID is required' },
      'ENTITY_ACCESS_DENIED': { status: 403, message: 'You do not have access to this entity' },
      'NO_ENTITY_AVAILABLE': { status: 400, message: 'No entity available' },
    };

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      const errorResponse = new ErrorResponse('Invoice number already exists');
      return res.status(409).json(errorResponse);
    }

    // Check for validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      const errorResponse = new ErrorResponse('Validation error: ' + messages.join(', '));
      return res.status(400).json(errorResponse);
    }

    const errorConfig = errorMap[error.message] || {
      status: error.status || 500,
      message: error.message || 'Internal server error'
    };

    const errorResponse = new ErrorResponse(errorConfig.message);
    return res.status(errorConfig.status).json(errorResponse);
  }
}

module.exports = new InvoiceController();