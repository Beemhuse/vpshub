import { useState } from "react";
import {
  Check,
  Download,
  ChevronRight,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBilling } from "../hooks/useApi";

export function Billing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const { invoices, usage, isLoading } = useBilling();

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 0,
      period: "forever",
      description: "Perfect for side projects and learning",
      features: [
        "3 servers",
        "1 teammate",
        "Core metrics",
        "Community support",
        "7-day log retention",
      ],
      current: true,
    },
    {
      id: "pro",
      name: "Pro",
      price: billingCycle === "monthly" ? 19 : 15,
      period: "month",
      description: "For growing teams and production workloads",
      features: [
        "10 servers",
        "5 teammates",
        "Advanced metrics",
        "Email alerts",
        "30-day log retention",
        "Priority support",
      ],
      highlighted: true,
    },
    {
      id: "business",
      name: "Business",
      price: billingCycle === "monthly" ? 49 : 39,
      period: "month",
      description: "For organizations with advanced needs",
      features: [
        "Unlimited servers",
        "Unlimited teammates",
        "Custom metrics",
        "Slack/Discord alerts",
        "90-day log retention",
        "24/7 priority support",
        "SSO & SAML",
      ],
    },
  ];

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading billing information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Billing</h2>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and payment methods
        </p>
      </div>

      {/* Current Plan Usage */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Current Plan: Starter
            </h3>
            <p className="text-sm text-muted-foreground">Free forever</p>
          </div>
          <Button className="bg-violet hover:bg-violet-600 text-white shadow-lg shadow-violet/20">
            Upgrade Plan
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div key="servers">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Servers</span>
              <span className="text-foreground">{usage?.servers || 0} / 3</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet"
                style={{ width: `${((usage?.servers || 0) / 3) * 100}%` }}
              />
            </div>
          </div>
          <div key="deployments">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Deployments</span>
              <span className="text-foreground">
                {usage?.deployments || 0} / 10
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet"
                style={{ width: `${((usage?.deployments || 0) / 10) * 100}%` }}
              />
            </div>
          </div>
          <div key="projects">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Projects</span>
              <span className="text-foreground">
                {usage?.projects || 0} / 2
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet"
                style={{ width: `${((usage?.projects || 0) / 2) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">
            Choose Your Plan
          </h3>
          <div className="flex items-center gap-2 p-1 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                billingCycle === "monthly"
                  ? "bg-violet text-white shadow-lg shadow-violet/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                billingCycle === "yearly"
                  ? "bg-violet text-white shadow-lg shadow-violet/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Yearly{" "}
              <span className="ml-1 text-[10px] text-success font-bold">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-2xl border p-6 transition-all",
                plan.highlighted
                  ? "bg-violet/10 border-violet/40 shadow-xl shadow-violet/5"
                  : "bg-white/[0.03] border-white/10 hover:border-white/20",
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-violet text-white uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h4 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-foreground">
                  ${plan.price}
                </span>
                <span className="text-muted-foreground">/{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-violet flex-shrink-0" />
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  "w-full h-10 transition-all active:scale-[0.98]",
                  plan.highlighted
                    ? "bg-violet hover:bg-violet-600 text-white shadow-lg shadow-violet/20"
                    : "bg-white/5 hover:bg-white/10 text-foreground border border-white/10",
                )}
                disabled={plan.current}
              >
                {plan.current ? "Current Plan" : "Select Plan"}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice History */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Invoice History
        </h3>
        <div className="space-y-2">
          {invoices?.map((invoice: any) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-violet/10 flex items-center justify-center group-hover:bg-violet/20 transition-colors">
                  <Download className="w-5 h-5 text-violet" />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {invoice.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="font-bold text-foreground">
                  ${invoice.amount}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-success/20 text-success border border-success/30">
                  {invoice.status}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
          {(!invoices || invoices.length === 0) && (
            <div className="py-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
              No invoices found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
