const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOTPEmail(email, otp, subject = "Your Verification Code") {
    try {
      const otpDigits = otp
        .toString()
        .split("")
        .map(
          (d) => `
          <td style="padding: 0 4px;">
            <div style="
              width: 40px; height: 48px;
              background: #ffffff;
              border: 1.5px solid #ed9329;
              border-radius: 8px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 22px;
              font-weight: 600;
              color: #ed9329;
              font-family: 'Courier New', monospace;
              text-align: center;
              line-height: 48px;
            ">${d}</div>
          </td>`
        )
        .join("");

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border: 1px solid #e5e7eb;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px; background:#ed9329;"></td>
          </tr>

          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 24px;">
              <img
                src="${process.env.LOGO_URL || "https://yourdomain.com/logo.png"}"
                alt="MIVA Prestige"
                width="180"
                style="display:block; max-width:180px; height:auto;"
              />
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height:1px; background:#f3f4f6;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <p style="margin:0 0 6px; font-size:14px; color:#6b7280;">Hello,</p>
              <h1 style="margin:0 0 16px; font-size:20px; font-weight:600; color:#111827;">
                Here's your verification code
              </h1>
              <p style="margin:0 0 24px; font-size:14px; color:#6b7280; line-height:1.6;">
                Use the code below to verify your identity. This code is valid for <strong style="color:#111827;">10 minutes</strong> and can only be used once.
              </p>

              <!-- OTP Label -->
              <p style="margin:0 0 10px; font-size:11px; color:#9ca3af; text-align:center; letter-spacing:1.5px; text-transform:uppercase;">
                One-time passcode
              </p>

              <!-- OTP Digits Box -->
              <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:20px; text-align:center;">
                <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                  <tr>${otpDigits}</tr>
                </table>
              </div>

              <!-- Expiry note -->
              <p style="margin:12px 0 0; font-size:12px; color:#9ca3af; text-align:center;">
                &#9719; Expires in 10 minutes
              </p>

              <!-- Divider -->
              <div style="height:1px; background:#f3f4f6; margin:24px 0;"></div>

              <!-- Warning box -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px 16px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:10px; vertical-align:top; padding-top:1px;">
                          <span style="font-size:14px;">⚠️</span>
                        </td>
                        <td style="font-size:12px; color:#92400e; line-height:1.6;">
                          If you didn't request this code, you can safely ignore this email.
                          <strong>Never share this code with anyone</strong>, including MIVA Prestige support.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #f3f4f6; padding:20px 32px; text-align:center;">
              <p style="margin:0 0 4px; font-size:11px; color:#9ca3af;">
                © ${new Date().getFullYear()} MIVA Prestige Ent. All rights reserved.
              </p>
              <p style="margin:0; font-size:11px; color:#d1d5db;">
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
      `;

      const mailOptions = {
        from: process.env.SMTP_FROM || "MIVA Prestige <noreply@mivaprestige.com>",
        to: email,
        subject,
        html: htmlContent,
        text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Email sending failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send invoice email with PDF attachment
   * @param {Object} invoice - Invoice object
   * @param {string} recipientEmail - Customer email
   * @param {string} message - Custom message
   * @param {Object} entity - Entity/Company details
   * @returns {Promise<Object>} - Email sending result
   */
  async sendInvoiceEmail(invoice, recipientEmail, message, entity) {
    try {
      // Generate PDF
      const pdfBuffer = await this.generateInvoicePDF(invoice, entity);

      // Prepare email HTML
      const htmlContent = this.buildInvoiceEmailHTML(invoice, message, entity);

      const mailOptions = {
        from: process.env.SMTP_FROM || `${entity?.name || "Company"} <noreply@mivaprestige.com>`,
        to: recipientEmail,
        subject: `Invoice ${invoice.number} from ${entity?.name || "Company"}`,
        html: htmlContent,
        text: message || `Please find attached invoice ${invoice.number} for your records.`,
        attachments: [
          {
            filename: `invoice-${invoice.number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Invoice email sending failed:", error);
      throw new Error(`Failed to send invoice email: ${error.message}`);
    }
  }

  /**
   * Generate invoice PDF
   * @param {Object} invoice - Invoice object
   * @param {Object} entity - Entity/Company details
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generateInvoicePDF(invoice, entity) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Invoice ${invoice.number}`,
            Author: entity?.name || 'Company',
            Subject: `Invoice ${invoice.number}`,
          }
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Add watermark if exists
        const watermarkText = entity?.metadata?.watermark || invoice.watermark || '';
        if (watermarkText) {
          const pageWidth = doc.page.width;
          const pageHeight = doc.page.height;
          doc.save();
          doc.opacity(0.05);
          doc.fontSize(60);
          doc.fillColor('#000000');
          doc.text(watermarkText, pageWidth / 2, pageHeight / 2, {
            align: 'center',
            valign: 'center',
            angle: -45,
          });
          doc.restore();
        }

        // Header
        const pageWidth = doc.page.width;
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#111827');
        doc.text('INVOICE', 50, 50);
        
        // Invoice number
        doc.fontSize(12).font('Helvetica').fillColor('#6b7280');
        doc.text(`# ${invoice.number}`, 50, 80);

        // Company info (right side)
        doc.fontSize(10).fillColor('#6b7280');
        const companyText = [
          entity?.name || 'Company Name',
          entity?.address || '',
          entity?.phone || '',
          entity?.email || '',
          entity?.tax_id ? `Tax ID: ${entity.tax_id}` : '',
        ].filter(Boolean);
        
        let yPos = 50;
        companyText.forEach(line => {
          doc.text(line, pageWidth - 200, yPos, { width: 180, align: 'right' });
          yPos += 16;
        });

        // Date and Due Date
        yPos = 120;
        doc.font('Helvetica').fontSize(10);
        doc.text('Date:', 50, yPos);
        doc.text(new Date(invoice.date).toLocaleDateString(), 120, yPos);
        yPos += 20;
        if (invoice.due_date) {
          doc.text('Due Date:', 50, yPos);
          doc.text(new Date(invoice.due_date).toLocaleDateString(), 120, yPos);
          yPos += 20;
        }

        // Customer Info
        yPos += 20;
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827');
        doc.text('Bill To:', 50, yPos);
        yPos += 20;
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280');
        doc.text(invoice.customer.name, 50, yPos);
        yPos += 16;
        if (invoice.customer.address) {
          doc.text(invoice.customer.address, 50, yPos);
          yPos += 16;
        }
        if (invoice.customer.email) {
          doc.text(invoice.customer.email, 50, yPos);
          yPos += 16;
        }
        if (invoice.customer.phone) {
          doc.text(invoice.customer.phone, 50, yPos);
          yPos += 16;
        }
        if (invoice.customer.tax_id) {
          doc.text(`Tax ID: ${invoice.customer.tax_id}`, 50, yPos);
          yPos += 16;
        }

        // Items Table
        yPos += 20;
        const tableTop = yPos;
        const tableWidth = pageWidth - 100;
        const colWidths = [tableWidth * 0.4, tableWidth * 0.15, tableWidth * 0.2, tableWidth * 0.25];

        // Table Header
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827');
        let xPos = 50;
        doc.rect(50, tableTop, tableWidth, 25).fill('#f3f4f6');
        doc.fillColor('#111827');
        doc.text('Description', xPos + 8, tableTop + 7);
        xPos += colWidths[0];
        doc.text('Qty', xPos + 8, tableTop + 7);
        xPos += colWidths[1];
        doc.text('Unit Price', xPos + 8, tableTop + 7);
        xPos += colWidths[2];
        doc.text('Total', xPos + 8, tableTop + 7);

        // Table Rows
        let rowY = tableTop + 25;
        doc.font('Helvetica').fontSize(9);
        invoice.items.forEach((item) => {
          const rowHeight = 20;
          xPos = 50;
          doc.fillColor('#4b5563');
          doc.text(item.name, xPos + 8, rowY + 5);
          xPos += colWidths[0];
          doc.text(item.quantity.toString(), xPos + 8, rowY + 5);
          xPos += colWidths[1];
          doc.text(`GHS ${item.price.toFixed(2)}`, xPos + 8, rowY + 5);
          xPos += colWidths[2];
          doc.text(`GHS ${(item.price * item.quantity).toFixed(2)}`, xPos + 8, rowY + 5);
          rowY += rowHeight;
        });

        // Totals
        const totalsY = rowY + 20;
        const totalsX = pageWidth - 180;
        doc.fontSize(10);
        doc.fillColor('#6b7280');
        doc.text('Subtotal:', totalsX, totalsY);
        doc.text(`GHS ${invoice.subtotal.toFixed(2)}`, totalsX + 120, totalsY, { align: 'right' });
        
        let currentY = totalsY + 20;
        if (invoice.discount_total > 0) {
          doc.text('Discount:', totalsX, currentY);
          doc.text(`-GHS ${invoice.discount_total.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });
          currentY += 20;
        }
        
        doc.text(`VAT (${invoice.vat_rate || 12.5}%):`, totalsX, currentY);
        doc.text(`GHS ${invoice.vat.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });
        currentY += 20;

        if (invoice.nhil > 0) {
          doc.text('NHIL (2.5%):', totalsX, currentY);
          doc.text(`GHS ${invoice.nhil.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });
          currentY += 20;
        }

        if (invoice.getfund > 0) {
          doc.text('GETFund (2.5%):', totalsX, currentY);
          doc.text(`GHS ${invoice.getfund.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });
          currentY += 20;
        }

        if (invoice.covid_levy > 0) {
          doc.text('COVID Levy (1%):', totalsX, currentY);
          doc.text(`GHS ${invoice.covid_levy.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });
          currentY += 20;
        }

        // Total
        currentY += 10;
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827');
        doc.text('Total:', totalsX, currentY);
        doc.text(`GHS ${invoice.total.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });

        // Amount Paid & Remaining
        if (invoice.amount_paid > 0) {
          currentY += 25;
          doc.font('Helvetica').fontSize(10).fillColor('#6b7280');
          doc.text('Amount Paid:', totalsX, currentY);
          doc.text(`GHS ${invoice.amount_paid.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });
        }

        if (invoice.remaining_balance > 0) {
          currentY += 20;
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#d97706');
          doc.text('Remaining Balance:', totalsX, currentY);
          doc.text(`GHS ${invoice.remaining_balance.toFixed(2)}`, totalsX + 120, currentY, { align: 'right' });
        }

        // Notes & Terms
        let notesY = currentY + 40;
        if (invoice.notes || invoice.terms) {
          doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
          if (invoice.notes) {
            doc.text('Notes:', 50, notesY);
            notesY += 16;
            doc.text(invoice.notes, 50, notesY, { width: tableWidth });
            notesY += 20;
          }
          if (invoice.terms) {
            doc.text('Terms:', 50, notesY);
            notesY += 16;
            doc.text(invoice.terms, 50, notesY, { width: tableWidth });
          }
        }

        // Footer
        const footerText = entity?.metadata?.footer_text || 'Thank you for your business!';
        doc.fontSize(8).fillColor('#9ca3af').text(footerText, 50, doc.page.height - 50, {
          align: 'center',
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Build invoice email HTML
   * @param {Object} invoice - Invoice object
   * @param {string} message - Custom message
   * @param {Object} entity - Entity/Company details
   * @returns {string} - HTML email content
   */
  buildInvoiceEmailHTML(invoice, message, entity) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice ${invoice.number}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border: 1px solid #e5e7eb;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px; background:#ed9329;"></td>
          </tr>

          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 24px;">
              <img
                src="${process.env.LOGO_URL || "https://yourdomain.com/logo.png"}"
                alt="${entity?.name || 'Company'}"
                width="180"
                style="display:block; max-width:180px; height:auto;"
              />
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height:1px; background:#f3f4f6;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h1 style="margin:0 0 16px; font-size:22px; font-weight:600; color:#111827;">
                Invoice #${invoice.number}
              </h1>
              <p style="margin:0 0 24px; font-size:14px; color:#6b7280; line-height:1.6;">
                ${message || `Please find attached invoice ${invoice.number} for your records.`}
              </p>

              <!-- Invoice Summary -->
              <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0; font-size:13px; color:#6b7280;">Amount</td>
                    <td style="padding:4px 0; font-size:13px; font-weight:600; color:#111827; text-align:right;">
                      ${invoice.currency || 'GHS'} ${invoice.total.toFixed(2)}
                    </td>
                  </tr>
                  ${invoice.due_date ? `
                  <tr>
                    <td style="padding:4px 0; font-size:13px; color:#6b7280;">Due Date</td>
                    <td style="padding:4px 0; font-size:13px; font-weight:500; color:#111827; text-align:right;">
                      ${new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding:4px 0; font-size:13px; color:#6b7280;">Customer</td>
                    <td style="padding:4px 0; font-size:13px; font-weight:500; color:#111827; text-align:right;">
                      ${invoice.customer.name}
                    </td>
                  </tr>
                  ${invoice.remaining_balance > 0 ? `
                  <tr>
                    <td style="padding:4px 0; font-size:13px; color:#6b7280;">Remaining Balance</td>
                    <td style="padding:4px 0; font-size:13px; font-weight:600; color:#d97706; text-align:right;">
                      ${invoice.currency || 'GHS'} ${invoice.remaining_balance.toFixed(2)}
                    </td>
                  </tr>
                  ` : ''}
                  ${invoice.payment_status === 'paid' ? `
                  <tr>
                    <td style="padding:4px 0; font-size:13px; color:#6b7280;">Status</td>
                    <td style="padding:4px 0; font-size:13px; font-weight:600; color:#10b981; text-align:right;">
                      ✓ Paid
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <!-- Message -->
              <p style="margin:0 0 16px; font-size:14px; color:#6b7280; line-height:1.6;">
                Please find attached the PDF version of your invoice.
              </p>

              <!-- Divider -->
              <div style="height:1px; background:#f3f4f6; margin:24px 0;"></div>

              <!-- Footer Info -->
              <p style="margin:0; font-size:12px; color:#9ca3af; text-align:center;">
                This is an automated message from ${entity?.name || 'Company'}.
                Please do not reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #f3f4f6; padding:20px 32px; text-align:center;">
              <p style="margin:0 0 4px; font-size:11px; color:#9ca3af;">
                © ${new Date().getFullYear()} ${entity?.name || 'Company'}. All rights reserved.
              </p>
              ${entity?.address ? `<p style="margin:0; font-size:11px; color:#d1d5db;">${entity.address}</p>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
    `;
  }
}

module.exports = new EmailService();