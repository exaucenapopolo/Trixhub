CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"country" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_activated" boolean DEFAULT false NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by_code" text,
	"preferred_currency" text DEFAULT 'FCFA' NOT NULL,
	"theme_preference" text DEFAULT 'light' NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"login_attempts" serial NOT NULL,
	"last_login_at" timestamp with time zone,
	"canva_requested_at" timestamp with time zone,
	"formation_requested_at" timestamp with time zone,
	"formation_requested_title" text,
	"last_daily_bonus_at" timestamp with time zone,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"referral_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"task_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"bonus_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"deposit_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"activity_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"inactive_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"withdrawn_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"spent_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balances_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text NOT NULL,
	"related_user_id" integer,
	"level" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"method" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"whatsapp_number" text,
	"source" text DEFAULT 'referral' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"fee_mode" text DEFAULT 'from_amount' NOT NULL,
	"fee_amount" integer,
	"payout_ref" text,
	"payout_status" text,
	"proof_url" text,
	"proof_token" text,
	"proof_uploaded_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reward" numeric(15, 2) NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tasks_user_task_unique" UNIQUE("user_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "swychr_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"target_user_id" integer,
	"payment_ref" text NOT NULL,
	"swychr_ref" text,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"phone_number" text NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"purpose" text DEFAULT 'activation' NOT NULL,
	"payment_url" text,
	"ussd_code" text,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swychr_transactions_payment_ref_unique" UNIQUE("payment_ref")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text,
	"payload" jsonb,
	"points_reward" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"activity_id" integer,
	"points_awarded" integer NOT NULL,
	"week_start" date NOT NULL,
	"day_of_week" integer NOT NULL,
	"payload_proof" jsonb,
	"status" text DEFAULT 'approved' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"daily_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'accumulating' NOT NULL,
	"converted_at" timestamp with time zone,
	"converted_amount" numeric(15, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_points_user_week_unique" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "activity_withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"method" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"whatsapp_number" text,
	"first_name" text,
	"last_name" text,
	"country" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"rejection_reason" text,
	"twilio_sent_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"questions" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"answers" jsonb,
	"score" integer,
	"points_awarded" integer
);
--> statement-breakpoint
CREATE TABLE "activity_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_type" text NOT NULL,
	"scheduled_date" date NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activities_type_active_idx" ON "activities" USING btree ("type","is_active");--> statement-breakpoint
CREATE INDEX "activity_completions_user_week_idx" ON "activity_completions" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "activity_completions_status_idx" ON "activity_completions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "activity_withdrawals_user_status_idx" ON "activity_withdrawals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "quiz_sessions_user_idx" ON "quiz_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_schedules_type_date_uniq" ON "activity_schedules" USING btree ("activity_type","scheduled_date");