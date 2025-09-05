# Email Integration Setup Guide

## Option 1: EmailJS (Easiest - No Backend Required)

### Step 1: Create EmailJS Account
1. Go to https://www.emailjs.com/
2. Sign up for a free account
3. Create a new service (Gmail, Outlook, etc.)

### Step 2: Install EmailJS
```bash
npm install @emailjs/browser
```

### Step 3: Add to your project
1. Get your EmailJS credentials from the dashboard
2. Add them to your environment variables
3. Update the invitation creation to send emails

### Step 4: Update InvitationManagement.tsx
Add email sending functionality when creating invitations.

## Option 2: Supabase Edge Functions + Resend (Recommended)

### Step 1: Create Resend Account
1. Go to https://resend.com/
2. Sign up and get API key
3. Verify your domain

### Step 2: Create Supabase Edge Function
1. Create a new Edge Function in Supabase
2. Add Resend integration
3. Trigger function when invitation is created

### Step 3: Update Database Triggers
Add a database trigger to automatically call the Edge Function when new invitations are created.

## Option 3: Simple SMTP Integration

### Step 1: Add Nodemailer
```bash
npm install nodemailer
```

### Step 2: Create Email Service
Create a simple email service using SMTP credentials.

### Step 3: Update Invitation Logic
Modify the invitation creation to send emails via SMTP.

## Current Database-Only Flow:
1. Admin creates invitation → Stored in database
2. User visits signup page → Checks database for invitation
3. User completes signup → Invitation marked as used

## With Email Integration:
1. Admin creates invitation → Stored in database + Email sent
2. User receives email with signup link
3. User clicks link → Goes to signup page
4. User completes signup → Invitation marked as used

## Recommended Next Steps:
1. Choose EmailJS for quick setup
2. Or choose Supabase Edge Functions + Resend for production
3. Update the invitation creation logic
4. Test with real email addresses
