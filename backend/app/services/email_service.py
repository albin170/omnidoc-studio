import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("omnidoc.email")

class EmailService:
    @staticmethod
    def _send_smtp_sync(to_email: str, subject: str, body_text: str, body_html: str) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
            msg["To"] = to_email
            msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info("Password reset email sent to %s via SMTP", to_email)
            return True
        except Exception as e:
            logger.error("Failed to send password reset email via SMTP: %s", e)
            return False

    @staticmethod
    async def send_password_reset_email(to_email: str, raw_token: str) -> bool:
        """
        Dispatches password reset instructions containing single-use cryptographic token.
        Uses asynchronous thread execution to avoid blocking the event loop (Section 5.A).
        In production, requires real configured SMTP and fails if delivery fails.
        """
        reset_link = f"{settings.FRONTEND_URL}/#reset-password?token={raw_token}"
        subject = "OmniDoc Studio — Password Reset Instructions"
        body_text = (
            f"Hello,\n\n"
            f"A password reset request was received for your OmniDoc Studio account.\n\n"
            f"To reset your password, please open the following link within 15 minutes:\n"
            f"{reset_link}\n\n"
            f"If you did not initiate this request, you can safely ignore this message.\n\n"
            f"Best regards,\n"
            f"OmniDoc Studio Security Team"
        )
        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #080B18; color: #F4F5FF; padding: 24px;">
                <div style="max-width: 600px; margin: auto; background-color: #11152A; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 24px;">
                    <h2 style="color: #8B7CFF;">OmniDoc Studio</h2>
                    <p style="color: #9BA3BD;">A password reset request was received for your account.</p>
                    <p>To choose a new password, click the button below within 15 minutes:</p>
                    <div style="margin: 24px 0;">
                        <a href="{reset_link}" style="background-color: #8B7CFF; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #9BA3BD;">If the button does not work, copy and paste this URL into your browser:<br>{reset_link}</p>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">
                    <p style="font-size: 11px; color: #64748B;">If you did not make this request, please disregard this email.</p>
                </div>
            </body>
        </html>
        """

        is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")

        if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
            return await asyncio.to_thread(EmailService._send_smtp_sync, to_email, subject, body_text, body_html)
        else:
            if is_prod:
                logger.error("Production email failure: SMTP provider is not configured.")
                return False
            logger.info("SMTP not configured; simulated email dispatch for %s (token length: %d)", to_email, len(raw_token))
            return True

email_service = EmailService()
