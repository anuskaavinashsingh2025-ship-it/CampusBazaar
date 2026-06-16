import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  ShoppingBag,
  Home,
  ArrowLeft,
  Grid3X3,
  Send,
  Clock,
  MessageCircle,
  CheckCircle,
  Shield,
  Star,
  Lock,
  Package,
  Plus,
  SlidersHorizontal,
  RefreshCcw,
  Calendar,
  Settings,
  Heart,
  ClipboardList,
  Bell,
  AlertTriangle,
  User,
  BookOpen,
  Utensils,
  ChevronDown,
  Bookmark,
  Trash2,
  XCircle,
  DollarSign,
  MapPin,
  MessageSquare,
  UserCircle,
  Search,
  ChefHat,
  BarChart2,
  Lightbulb,
} from "lucide-react";

export const Route = createFileRoute("/tour")({
  head: () => ({
    meta: [{ title: "Tour — CampusBazaar" }],
  }),
  component: TourPage,
});

// ─── ROLE ROADMAP TYPES ───────────────────────────────────────────────────────

type Role = "buyer" | "seller" | "renter";

const roles = [
  {
    id: "buyer" as Role,
    label: "Buyer",
    icon: ShoppingCart,
    description: "Buy products, food, notes, or rent items.",
    accent: "#2563EB",
    bg: "bg-blue-50",
    border: "border-blue-500",
    iconBg: "bg-blue-500",
    stepColor: "bg-blue-500",
  },
  {
    id: "seller" as Role,
    label: "Seller",
    icon: ShoppingBag,
    description: "Sell your items, notes, or food.",
    accent: "#16A34A",
    bg: "bg-green-50",
    border: "border-green-500",
    iconBg: "bg-green-500",
    stepColor: "bg-green-500",
  },
  {
    id: "renter" as Role,
    label: "Renter",
    icon: Home,
    description: "Rent items like calculators, lab coats, and more.",
    accent: "#EA580C",
    bg: "bg-orange-50",
    border: "border-orange-500",
    iconBg: "bg-orange-500",
    stepColor: "bg-orange-500",
  },
];

type Step = {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "action" | "pending" | "active" | "completed" | "incoming" | "decision";
  side: "left" | "right";
};

const buyerSteps: Step[] = [
  { id: 1, title: "Browse Listings", description: "Explore products, food, notes, and rentals posted by other students.", icon: Grid3X3, badge: "Explore", badgeVariant: "active", side: "left" },
  { id: 2, title: "Send a Request", description: "Found something you like? Click Request Deal. Your request is sent to the owner.", icon: Send, badge: "Action Required", badgeVariant: "action", side: "right" },
  { id: 3, title: "Wait for a Decision", description: "The owner can Accept or Reject. Check Notifications or Requests for updates.", icon: Clock, badge: "Pending", badgeVariant: "pending", side: "left" },
  { id: 4, title: "Chat Unlocks", description: "If accepted, a private chat is created automatically. Use chat to discuss price, location, timing, and more.", icon: MessageCircle, badge: "Active", badgeVariant: "active", side: "right" },
  { id: 5, title: "Mark Complete", description: "Once everything is finalized, either user can click Mark Complete.", icon: CheckCircle, badge: "Action Required", badgeVariant: "action", side: "left" },
  { id: 6, title: "Confirmation Required", description: "The other user can Confirm or Decline Completion. If declined, chat remains active.", icon: Shield, badge: "Pending", badgeVariant: "pending", side: "right" },
];

const sellerSteps: Step[] = [
  { id: 1, title: "Create a Listing", description: "Post your products, food items, or notes for other students. Add Photos, Description, and Price.", icon: Plus, badge: "Setup", badgeVariant: "active", side: "left" },
  { id: 2, title: "Receive Requests", description: "Interested students send you requests. View them from Requests or Notifications.", icon: Send, badge: "Incoming", badgeVariant: "incoming", side: "right" },
  { id: 3, title: "Accept or Reject", description: "Choose whether to proceed with the request.", icon: SlidersHorizontal, badge: "Decision", badgeVariant: "decision", side: "left" },
  { id: 4, title: "Chat & Coordinate", description: "Once accepted, chat unlocks. Coordinate details with the buyer.", icon: MessageCircle, badge: "Active", badgeVariant: "active", side: "right" },
  { id: 5, title: "Mark Complete", description: "Once the deal is finalized, either side can click Mark Complete.", icon: CheckCircle, badge: "Action", badgeVariant: "action", side: "left" },
  { id: 6, title: "Confirm Completion", description: "The other user must confirm. If declined, chat remains active.", icon: Shield, badge: "Pending", badgeVariant: "pending", side: "right" },
];

const renterSteps: Step[] = [
  { id: 1, title: "Browse Rental Listings", description: "Find calculators, lab coats, or other rentable items posted by students.", icon: Grid3X3, badge: "Explore", badgeVariant: "active", side: "left" },
  { id: 2, title: "Send Rental Request", description: "Click Rent Item to send a rental request to the owner.", icon: Send, badge: "Action", badgeVariant: "action", side: "right" },
  { id: 3, title: "Owner Reviews Request", description: "The owner can Accept or Reject Rental. Check Notifications and Requests for updates.", icon: Clock, badge: "Pending", badgeVariant: "pending", side: "left" },
  { id: 4, title: "Chat Unlocks", description: "Once accepted, a private chat is created. Coordinate details like pickup, timing, deposit, and more.", icon: MessageCircle, badge: "Active", badgeVariant: "active", side: "right" },
  { id: 5, title: "Rental Starts", description: "The owner clicks Mark as Rented Out. The item is now rented out, hidden from others.", icon: Package, badge: "Active", badgeVariant: "active", side: "left" },
  { id: 6, title: "Rental Active", description: "The rental is in progress. Use chat to coordinate during the rental period.", icon: Calendar, badge: "In Progress", badgeVariant: "incoming", side: "right" },
  { id: 7, title: "Return Item", description: "When you're done, click Return Item to notify the owner.", icon: RefreshCcw, badge: "Action", badgeVariant: "action", side: "left" },
  { id: 8, title: "Owner Completes", description: "The owner clicks Complete Rental once the item is returned.", icon: CheckCircle, badge: "Action", badgeVariant: "action", side: "right" },
  { id: 9, title: "Confirmation Required", description: "The other user must confirm. If declined, chat remains active.", icon: Shield, badge: "Pending", badgeVariant: "pending", side: "left" },
  { id: 10, title: "Choose Listing Status", description: "After completion, the owner chooses: Make Available Again (relisted) or Keep Unavailable.", icon: Settings, badge: "Decision", badgeVariant: "decision", side: "right" },
];

const stepsMap: Record<Role, Step[]> = { buyer: buyerSteps, seller: sellerSteps, renter: renterSteps };

const completionMap: Record<Role, { title: string; message: string; items: { icon: React.ElementType; label: string; description: string }[] }> = {
  buyer: {
    title: "Transaction Completed!",
    message: "Once both users agree:",
    items: [
      { icon: Lock, label: "Chat locks", description: "No more messages can be sent." },
      { icon: Package, label: "Listing removed", description: "The item is no longer visible in the marketplace." },
      { icon: Star, label: "Ratings available", description: "You can now rate each other." },
    ],
  },
  seller: {
    title: "Listing Removed!",
    message: "After completion, here's what happens:",
    items: [
      { icon: Lock, label: "Chat locks", description: "No more messages can be sent." },
      { icon: Package, label: "Listing removed", description: "Your listing is no longer visible in the marketplace." },
      { icon: Star, label: "Ratings unlock", description: "Both users can now leave ratings." },
    ],
  },
  renter: {
    title: "Rental Completed!",
    message: "Great job! You've completed the rental.",
    items: [
      { icon: Lock, label: "Chat locks", description: "No more messages can be sent." },
      { icon: Star, label: "Ratings available", description: "Both users can now rate each other." },
      { icon: Package, label: "Listing follows owner's choice", description: "The owner's selected status is applied." },
    ],
  },
};

function BadgePill({ variant, label }: { variant?: Step["badgeVariant"]; label?: string }) {
  if (!label) return null;
  const styles: Record<string, string> = {
    action: "bg-blue-100 text-blue-700",
    pending: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-700",
    incoming: "bg-purple-100 text-purple-700",
    decision: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant ?? "completed"]}`}>
      {label}
    </span>
  );
}

// ─── FEATURE DISCOVERY TYPES & DATA ──────────────────────────────────────────

type FeatureBullet = { icon: React.ElementType; text: string };
type Feature = {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  shortDesc: string;
  description: string;
  bullets: FeatureBullet[];
  tip: string;
  visual: string;
};

const features: Feature[] = [
  {
    id: "wishlist",
    icon: Heart,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-50",
    title: "Wishlist",
    shortDesc: "Save listings you like and revisit them later.",
    description: "Not ready to buy yet? Add any listing to your Wishlist and come back when you are. Your saved items stay organized and easy to access anytime.",
    bullets: [
      { icon: Bookmark, text: "Keep track of interesting listings" },
      { icon: Clock, text: "Access saved items anytime" },
      { icon: Trash2, text: "Remove items when no longer needed" },
    ],
    tip: "Wishlist items are private — only you can see them.",
    visual: "wishlist",
  },
  {
    id: "requests",
    icon: ClipboardList,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
    title: "Requests",
    shortDesc: "Track all your buy and rent requests in one place.",
    description: "Every request you send or receive lives here. Filter by status to see exactly where each deal stands.",
    bullets: [
      { icon: Clock, text: "Pending requests awaiting a response" },
      { icon: CheckCircle, text: "Accepted requests ready to proceed" },
      { icon: MessageCircle, text: "Active transactions with open chat" },
      { icon: Star, text: "Completed transactions" },
      { icon: XCircle, text: "Rejected requests" },
    ],
    tip: "Check Requests regularly — owners may respond quickly.",
    visual: "requests",
  },
  {
    id: "chat",
    icon: MessageCircle,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    title: "Secure Chat",
    shortDesc: "Every accepted request unlocks a private chat.",
    description: "Once a request is accepted, a dedicated chat is created for that transaction. Use it to coordinate all the details privately and securely.",
    bullets: [
      { icon: DollarSign, text: "Negotiate pricing" },
      { icon: MapPin, text: "Share meetup locations" },
      { icon: Clock, text: "Arrange pickup times" },
      { icon: Package, text: "Discuss transaction details" },
    ],
    tip: "Chats stay linked to their listing — context is always there.",
    visual: "chat",
  },
  {
    id: "notifications",
    icon: Bell,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    title: "Notifications",
    shortDesc: "Stay updated without constantly checking requests.",
    description: "CampusBazaar notifies you the moment something important happens. You never have to refresh and wonder.",
    bullets: [
      { icon: CheckCircle, text: "Request accepted" },
      { icon: XCircle, text: "Request rejected" },
      { icon: MessageCircle, text: "New message received" },
      { icon: Package, text: "Transaction completed" },
      { icon: Star, text: "Rating received" },
    ],
    tip: "Important updates always appear here first.",
    visual: "notifications",
  },
  {
    id: "ratings",
    icon: Star,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-50",
    title: "Ratings & Reviews",
    shortDesc: "Build trust within the campus community.",
    description: "After every completed transaction, both users can rate each other and leave a review. Ratings appear on public profiles and help the whole campus make better decisions.",
    bullets: [
      { icon: Star, text: "Rate other users after a deal" },
      { icon: MessageSquare, text: "Leave written feedback" },
      { icon: User, text: "View ratings on public profiles" },
    ],
    tip: "A strong rating history builds credibility over time.",
    visual: "ratings",
  },
  {
    id: "report",
    icon: AlertTriangle,
    iconColor: "text-red-500",
    iconBg: "bg-red-50",
    title: "Report System",
    shortDesc: "Help keep CampusBazaar safe for everyone.",
    description: "If something feels off, you can report it. Reports are reviewed by administrators to keep the platform trustworthy.",
    bullets: [
      { icon: Package, text: "Report suspicious listings" },
      { icon: User, text: "Report problematic sellers" },
      { icon: MessageCircle, text: "Report harmful chat messages" },
    ],
    tip: "All reports are confidential and reviewed by admins.",
    visual: "report",
  },
  {
    id: "seller-profile",
    icon: User,
    iconColor: "text-teal-500",
    iconBg: "bg-teal-50",
    title: "Public Seller Profiles",
    shortDesc: "Learn about a seller before making a deal.",
    description: "Every CampusBazaar user has a public profile. Browse their ratings, reviews, and active listings before committing to a request.",
    bullets: [
      { icon: UserCircle, text: "Profile photo and basic info" },
      { icon: Star, text: "Overall rating and reviews" },
      { icon: Package, text: "Active listings from this seller" },
    ],
    tip: "Always check a seller's profile before sending a request.",
    visual: "seller-profile",
  },
  {
    id: "notes",
    icon: BookOpen,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    title: "Notes Request",
    shortDesc: "Find or share study material with your campus.",
    description: "Need notes for a subject? Send a Notes Request and let sellers come to you. Or list your own notes if others might benefit.",
    bullets: [
      { icon: Search, text: "Browse available notes listings" },
      { icon: Send, text: "Send a request for specific notes" },
      { icon: BookOpen, text: "Sell or rent your own notes" },
    ],
    tip: "Choose whichever option fits your needs best.",
    visual: "notes",
  },
  {
    id: "food",
    icon: Utensils,
    iconColor: "text-green-600",
    iconBg: "bg-green-50",
    title: "Food Request",
    shortDesc: "Request food or respond to food requests on campus.",
    description: "Craving something specific? Send a Food Request and let vendors or fellow students respond. Everything stays organized inside CampusBazaar.",
    bullets: [
      { icon: Utensils, text: "Request food items you want" },
      { icon: ChefHat, text: "Respond to requests if you can fulfil them" },
      { icon: Package, text: "Coordinate delivery or pickup via chat" },
    ],
    tip: "Food requests and listings are kept separate for clarity.",
    visual: "food",
  },
];

const STORAGE_KEY = "cb_explored_features";

function getExplored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExplored(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

// ─── VISUAL COMPONENTS ───────────────────────────────────────────────────────

function WishlistVisual() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center justify-center gap-6 py-2">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm w-36">
        <div className="mb-2 h-12 w-full rounded-lg bg-slate-100" />
        <div className="text-xs font-semibold text-slate-700">Scientific Calculator</div>
        <div className="text-xs text-orange-500 font-bold mt-0.5">₹250</div>
      </div>
      <Heart
        className="h-10 w-10 transition-transform duration-500"
        style={{
          color: "#ef4444",
          fill: "#ef4444",
          transform: pulse ? "scale(1.25)" : "scale(1)",
        }}
      />
    </div>
  );
}

type FlowStep = { icon: React.ElementType; label: string; badge: string; badgeClass: string };

function FlowVisual({ steps }: { steps: FlowStep[] }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (visible >= steps.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 350);
    return () => clearTimeout(t);
  }, [visible, steps.length]);

  return (
    <div className="flex flex-col gap-1.5 py-1">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="flex items-center gap-3 transition-all duration-400"
            style={{
              opacity: i < visible ? 1 : 0,
              transform: i < visible ? "translateY(0)" : "translateY(8px)",
              transitionDuration: "350ms",
            }}
          >
            {i > 0 && (
              <div className="absolute ml-3.5 -mt-4 h-3 w-px bg-slate-200" />
            )}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
              <Icon className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <span className="text-xs font-medium text-slate-700">{s.label}</span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badgeClass}`}>
              {s.badge}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RequestsVisual() {
  return (
    <FlowVisual
      steps={[
        { icon: Send, label: "Request Sent", badge: "Pending", badgeClass: "bg-yellow-100 text-yellow-700" },
        { icon: CheckCircle, label: "Accepted", badge: "Accepted", badgeClass: "bg-green-100 text-green-700" },
        { icon: MessageCircle, label: "Chat Opened", badge: "Active", badgeClass: "bg-blue-100 text-blue-700" },
        { icon: Star, label: "Completed", badge: "Done", badgeClass: "bg-emerald-100 text-emerald-700" },
      ]}
    />
  );
}

function ChatVisual() {
  const messages = [
    { side: "left", text: "Is the price negotiable?" },
    { side: "right", text: "Yes, I can do ₹50 less." },
    { side: "left", text: "Deal! Where do we meet?" },
  ];
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (visible >= messages.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 450);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="flex flex-col gap-2 py-1">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${m.side === "right" ? "justify-end" : "justify-start"} transition-all duration-400`}
          style={{
            opacity: i < visible ? 1 : 0,
            transform: i < visible ? "translateX(0)" : m.side === "left" ? "translateX(-16px)" : "translateX(16px)",
            transitionDuration: "350ms",
          }}
        >
          <span
            className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-xs ${
              m.side === "right"
                ? "bg-orange-500 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {m.text}
          </span>
        </div>
      ))}
    </div>
  );
}

const notifCards = [
  { icon: CheckCircle, color: "text-green-500", title: "Request Accepted", body: "Your request was accepted.", dot: "bg-green-500" },
  { icon: MessageCircle, color: "text-blue-500", title: "New Message", body: "You have a new message.", dot: "bg-blue-500" },
  { icon: Star, color: "text-yellow-500", title: "Rating Received", body: "Someone rated you 5 stars.", dot: "bg-yellow-500" },
  { icon: Package, color: "text-purple-500", title: "Deal Completed", body: "Transaction marked complete.", dot: "bg-purple-500" },
];

function NotificationsVisual() {
  const [idx, setIdx] = useState(0);
  const [animIn, setAnimIn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setAnimIn(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % notifCards.length);
        setAnimIn(true);
      }, 200);
    }, 2000);
    return () => clearInterval(t);
  }, []);
  const card = notifCards[idx];
  const Icon = card.icon;
  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div
        className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200"
        style={{ opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(-6px)" }}
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 shrink-0 ${card.color}`} />
          <div>
            <div className="text-xs font-semibold text-slate-800">{card.title}</div>
            <div className="text-[11px] text-slate-500">{card.body}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {notifCards.map((c, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? `w-4 ${c.dot}` : "w-1.5 bg-slate-200"}`}
          />
        ))}
      </div>
    </div>
  );
}

function RatingsVisual() {
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    if (filled >= 5) return;
    const t = setTimeout(() => setFilled((f) => f + 1), 160);
    return () => clearTimeout(t);
  }, [filled]);
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className="h-6 w-6 transition-all duration-200"
            style={{
              color: s <= filled ? "#eab308" : "#e2e8f0",
              fill: s <= filled ? "#eab308" : "#e2e8f0",
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
          RS
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Rohit S.</span>
            <span className="text-xs font-bold text-yellow-500">5.0</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">Smooth transaction, very responsive!</p>
          <p className="text-[10px] text-slate-400 mt-0.5">2 days ago</p>
        </div>
      </div>
    </div>
  );
}

const reportTabs = {
  Listing: ["Misleading description", "Fake or spam listing", "Inappropriate content"],
  Seller: ["Harassment or threats", "No-show at meetup", "Scam behavior"],
  Chat: ["Abusive language", "Sharing personal data", "Threatening messages"],
};

function ReportVisual() {
  const [tab, setTab] = useState<keyof typeof reportTabs>("Listing");
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {(Object.keys(reportTabs) as (keyof typeof reportTabs)[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
              tab === t ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {reportTabs[tab].map((reason) => (
          <div key={reason} className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" />
            <span className="text-xs text-slate-700">{reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SellerProfileVisual() {
  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
            AK
          </div>
          <span className="text-sm font-bold text-slate-800">Aditya K.</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((s) => (
              <Star key={s} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            ))}
            <Star className="h-3.5 w-3.5 fill-yellow-100 text-yellow-300" />
            <span className="ml-1 text-xs font-bold text-slate-700">4.8</span>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <Package className="h-3 w-3" /> 12 Listings
            </span>
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <CheckCircle className="h-3 w-3" /> 34 Deals
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Member since 2024</span>
        </div>
      </div>
    </div>
  );
}

function NotesRequestVisual() {
  return (
    <FlowVisual
      steps={[
        { icon: BookOpen, label: "Browse Notes", badge: "Explore", badgeClass: "bg-blue-100 text-blue-700" },
        { icon: Send, label: "Send Request", badge: "Action", badgeClass: "bg-indigo-100 text-indigo-700" },
        { icon: MessageCircle, label: "Chat Opens", badge: "Active", badgeClass: "bg-green-100 text-green-700" },
        { icon: CheckCircle, label: "Complete", badge: "Done", badgeClass: "bg-emerald-100 text-emerald-700" },
      ]}
    />
  );
}

function FoodRequestVisual() {
  return (
    <FlowVisual
      steps={[
        { icon: Utensils, label: "Food Request", badge: "Sent", badgeClass: "bg-orange-100 text-orange-700" },
        { icon: ChefHat, label: "Vendor Responds", badge: "Incoming", badgeClass: "bg-yellow-100 text-yellow-700" },
        { icon: MessageCircle, label: "Chat Opens", badge: "Active", badgeClass: "bg-green-100 text-green-700" },
        { icon: CheckCircle, label: "Complete", badge: "Done", badgeClass: "bg-emerald-100 text-emerald-700" },
      ]}
    />
  );
}

function FeatureVisual({ visual }: { visual: string }) {
  switch (visual) {
    case "wishlist": return <WishlistVisual />;
    case "requests": return <RequestsVisual />;
    case "chat": return <ChatVisual />;
    case "notifications": return <NotificationsVisual />;
    case "ratings": return <RatingsVisual />;
    case "report": return <ReportVisual />;
    case "seller-profile": return <SellerProfileVisual />;
    case "notes": return <NotesRequestVisual />;
    case "food": return <FoodRequestVisual />;
    default: return null;
  }
}

// ─── ACCORDION ITEM ───────────────────────────────────────────────────────────

function FeatureAccordion({
  feature,
  isOpen,
  isExplored,
  onToggle,
}: {
  feature: Feature;
  isOpen: boolean;
  isExplored: boolean;
  onToggle: () => void;
}) {
  const Icon = feature.icon;
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isOpen]);

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-shadow duration-200 ${isOpen ? "shadow-md" : ""}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${feature.iconBg}`}>
          <Icon className={`h-5 w-5 ${feature.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{feature.title}</span>
            {isExplored && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                Explored
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{feature.shortDesc}</p>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Expandable body */}
      <div
        className="overflow-hidden transition-all duration-350 ease-in-out"
        style={{ height, opacity: isOpen ? 1 : 0, transitionDuration: "320ms" }}
      >
        <div ref={contentRef} className="border-t border-slate-100 px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-slate-600 leading-relaxed">{feature.description}</p>

          {/* Bullets */}
          <div className="mb-4 flex flex-col gap-2">
            {feature.bullets.map((b, i) => {
              const BIcon = b.icon;
              return (
                <div key={i} className="flex items-center gap-2">
                  <BIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="text-xs text-slate-700">{b.text}</span>
                </div>
              );
            })}
          </div>

          {/* Visual */}
          <div className="mb-3 rounded-xl bg-slate-50 px-4 py-3">
            <FeatureVisual visual={feature.visual} />
          </div>

          {/* Tip */}
          <div className="flex items-start gap-1.5 text-xs text-slate-400">
            <span className="mt-px shrink-0 font-semibold text-slate-500">Tip:</span>
            <span>{feature.tip}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FEATURE DISCOVERY SECTION ────────────────────────────────────────────────

function FeatureDiscovery() {
  const [explored, setExplored] = useState<string[]>(() => getExplored());
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    const isOpening = openId !== id;
    setOpenId(isOpening ? id : null);
    if (isOpening && !explored.includes(id)) {
      const next = [...explored, id];
      setExplored(next);
      saveExplored(next);
    }
  };

  const count = explored.length;
  const total = features.length;
  const pct = (count / total) * 100;

  return (
    <div className="mt-12">
      {/* Divider */}
      <div className="mb-10 flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200" />
        <ChevronDown className="h-5 w-5 text-slate-400" />
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Section header */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <Search className="h-5 w-5 text-indigo-500" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Feature <span className="text-indigo-500">Discovery</span>
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Discover tools and features that make CampusBazaar easier to use.
        </p>
      </div>

      {/* Progress tracker */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
          <BarChart2 className="h-5 w-5 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Feature Discovery Progress</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-sm font-bold text-indigo-600">
              {count} / {total}
            </span>
            <span className="shrink-0 text-xs text-slate-500">Features Explored</span>
            <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 8 }}>
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Accordion list */}
      <div className="flex flex-col gap-3">
        {features.map((f) => (
          <FeatureAccordion
            key={f.id}
            feature={f}
            isOpen={openId === f.id}
            isExplored={explored.includes(f.id)}
            onToggle={() => handleToggle(f.id)}
          />
        ))}
      </div>

      {/* Bottom tip */}
      <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-400" />
        <span>
          <span className="font-semibold text-slate-600">Tip:</span> Explore each feature to understand how it helps you get the most out of{" "}
          <span className="font-bold text-slate-700">CampusBazaar</span>.
        </span>
      </div>
    </div>
  );
}

// ─── DID YOU KNOW SECTION ────────────────────────────────────────────────────

type Tip = {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  bold: string;
  text: string;
};

type SpecialTip = {
  type: "lifecycle";
};

const tips: (Tip | SpecialTip)[] = [
  { icon: MessageCircle, iconColor: "text-purple-500", iconBg: "bg-purple-100", bold: "Every accepted request", text: "automatically unlocks a private chat between both users." },
  { icon: Settings, iconColor: "text-green-500", iconBg: "bg-green-100", bold: "Listings can be edited", text: "anytime if you need to update pricing, photos, or descriptions." },
  { icon: Trash2, iconColor: "text-red-500", iconBg: "bg-red-100", bold: "You can delete your", text: "listings whenever they are no longer available." },
  { icon: UserCircle, iconColor: "text-blue-500", iconBg: "bg-blue-100", bold: "Seller profiles are public", text: "and can be viewed by any user before making a deal." },
  { icon: Star, iconColor: "text-yellow-500", iconBg: "bg-yellow-100", bold: "Ratings and reviews", text: "help students identify trustworthy buyers, sellers, and renters." },
  { icon: CheckCircle, iconColor: "text-emerald-500", iconBg: "bg-emerald-100", bold: "Completed transactions", text: "unlock the ability to leave ratings." },
  { icon: Shield, iconColor: "text-indigo-500", iconBg: "bg-indigo-100", bold: "CampusBazaar actively reviews reports", text: "to help keep the community safe." },
  { icon: AlertTriangle, iconColor: "text-red-500", iconBg: "bg-red-100", bold: "Users who repeatedly violate", text: "community guidelines or engage in malicious activity may be restricted or permanently banned." },
  { icon: Package, iconColor: "text-orange-500", iconBg: "bg-orange-100", bold: "Rental listings automatically", text: "disappear from the marketplace while actively rented out." },
  { icon: RefreshCcw, iconColor: "text-blue-500", iconBg: "bg-blue-100", bold: "Once a rental is completed,", text: "the owner can choose whether to make the item available again or keep it unavailable." },
  { icon: BookOpen, iconColor: "text-green-600", iconBg: "bg-green-100", bold: "Notes can be sold, rented,", text: "or requested depending on what students need." },
  { icon: Utensils, iconColor: "text-orange-500", iconBg: "bg-orange-100", bold: "Food Requests", text: "let students request specific food items even if no active listing currently exists." },
  { icon: Bell, iconColor: "text-blue-500", iconBg: "bg-blue-100", bold: "Notifications", text: "keep you updated about requests, messages, completions, ratings, and important account activity." },
  { icon: MessageSquare, iconColor: "text-purple-500", iconBg: "bg-purple-100", bold: "If you encounter bugs,", text: "have suggestions, or want to request new features, you can submit feedback directly through CampusBazaar." },
  { icon: RefreshCcw, iconColor: "text-teal-500", iconBg: "bg-teal-100", bold: "Marketplace transactions", text: "stay organized because chats remain linked to the original listing and request." },
  { type: "lifecycle" },
];

function LifecycleVisual() {
  const lcSteps = [
    { icon: Send, label: "Request", color: "#6366f1" },
    { icon: MessageCircle, label: "Chat", color: "#a855f7" },
    { icon: CheckCircle, label: "Complete", color: "#22c55e" },
    { icon: Star, label: "Review", color: "#eab308" },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold text-slate-700">
        Accepted requests move through a complete lifecycle:
      </p>
      <div className="flex items-center gap-1">
        {lcSteps.map((s, i) => {
          const Icon = s.icon;
          return (
            <React.Fragment key={s.label}>
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: s.color + "1A" }}>
                  <Icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
                <span className="text-[10px] text-slate-500">{s.label}</span>
              </div>
              {i < lcSteps.length - 1 && (
                <div className="mb-4 flex flex-1 items-center gap-0.5">
                  <div className="h-px flex-1 border-t border-dashed border-slate-300" />
                  <ChevronDown className="h-3 w-3 -rotate-90 text-slate-400" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">making it easy to track every transaction.</p>
    </div>
  );
}

function DidYouKnow() {
  // Split into pairs for 2-column grid, lifecycle card spans full width
  const pairs: (Tip | SpecialTip)[][] = [];
  let i = 0;
  while (i < tips.length) {
    const t = tips[i];
    if ("type" in t) {
      pairs.push([t]);
      i++;
    } else if (i + 1 < tips.length && !("type" in tips[i + 1])) {
      pairs.push([t, tips[i + 1] as Tip]);
      i += 2;
    } else {
      pairs.push([t]);
      i++;
    }
  }

  return (
    <div className="mt-12">
      {/* Divider */}
      <div className="mb-10 flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200" />
        <ChevronDown className="h-5 w-5 text-slate-400" />
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Lightbulb className="h-5 w-5 text-amber-500" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Did You <span className="text-orange-500">Know?</span>
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Discover hidden tips and useful features across CampusBazaar.
        </p>
      </div>

      {/* Tips grid */}
      <div className="flex flex-col gap-3">
        {pairs.map((pair, pi) => (
          <div key={pi} className={`grid gap-3 ${pair.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {pair.map((tip, ti) => {
              if ("type" in tip) {
                return <LifecycleVisual key={ti} />;
              }
              const Icon = tip.icon;
              return (
                <div key={ti} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tip.iconBg}`}>
                    <Icon className={`h-5 w-5 ${tip.iconColor}`} />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <Lightbulb className="mr-1 inline h-3 w-3 text-amber-400" />
                    <span className="font-bold text-slate-800">{tip.bold}</span>{" "}
                    {tip.text}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-100 px-5 py-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <p className="text-xs text-slate-600">
            These tips help you navigate CampusBazaar like a pro and make the most of every feature.
          </p>
        </div>
        <p className="text-sm font-bold text-slate-700">
          Happy buying, selling, renting, and learning!{" "}
          <span className="text-green-500">&#10084;</span>
        </p>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

function TourPage() {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const journeyRef = useRef<HTMLDivElement>(null);
  const [journeyHeight, setJourneyHeight] = useState(0);

  const role = roles.find((r) => r.id === activeRole) ?? null;
  const steps = activeRole ? stepsMap[activeRole] : [];
  const completion = activeRole ? completionMap[activeRole] : null;
  const finalStep = steps.length + 1;

  useEffect(() => {
    if (activeRole && journeyRef.current) {
      setJourneyHeight(journeyRef.current.scrollHeight);
    } else {
      setJourneyHeight(0);
    }
  }, [activeRole, steps]);

  const handleRoleClick = (id: Role) => {
    setActiveRole((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-slate-800">
            Campus<span className="text-orange-500">Bazaar</span>
          </span>
        </div>
        <button
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Marketplace
        </button>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-2 text-4xl">🎓</div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            Campus<span className="text-orange-500">Bazaar</span> Tour
          </h1>
          <p className="mt-2 text-slate-500">Learn how CampusBazaar works in under 2 minutes.</p>
        </div>

        {/* Role Selector */}
        <div className="mb-10">
          <div className="mb-1 flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-orange-300" />
            <h2 className="text-base font-semibold text-slate-700">Choose Your Role</h2>
            <div className="h-px w-8 bg-orange-300" />
          </div>
          <p className="mb-5 text-center text-sm text-slate-400">What would you like to do today?</p>
          <div className="grid grid-cols-3 gap-3">
            {roles.map((r) => {
              const Icon = r.icon;
              const isActive = activeRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => handleRoleClick(r.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200 ${
                    isActive
                      ? `${r.border} ${r.bg} shadow-md`
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isActive ? r.iconBg : "bg-slate-100"} transition-colors`}>
                    <Icon className={`h-6 w-6 ${isActive ? "text-white" : "text-slate-500"}`} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: isActive ? r.accent : "#475569" }}>
                    <Icon className="mr-1 inline h-3.5 w-3.5" />
                    {r.label}
                  </span>
                  <span className="text-xs text-slate-500">{r.description}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            {activeRole ? "Click the same role again to collapse." : "Click a role to see how CampusBazaar works."}
          </p>
        </div>

        {/* Journey — collapses when no role selected */}
        <div
          className="overflow-hidden transition-all duration-500 ease-in-out"
          style={{ height: journeyHeight, opacity: activeRole ? 1 : 0, marginBottom: activeRole ? 0 : 0 }}
        >
          <div ref={journeyRef}>
          {role && completion && (
          <div className={`rounded-2xl border-2 p-6 transition-all duration-300 ${role.border} ${role.bg}`}>
          <div className="mb-6 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              <role.icon className="h-5 w-5" style={{ color: role.accent }} />
              <h3 className="text-xl font-extrabold" style={{ color: role.accent }}>
                {role.label} Journey
              </h3>
            </div>
            <p className="text-sm text-slate-500">
              Follow these simple steps to{" "}
              {activeRole === "buyer"
                ? "complete a successful transaction"
                : activeRole === "seller"
                ? "sell successfully on CampusBazaar"
                : "rent successfully on CampusBazaar"}.
            </p>
          </div>

          <div className="relative">
            <div
              className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2"
              style={{ backgroundColor: role.accent + "33" }}
            />
            <div className="space-y-4">
              {steps.map((step) => {
                const Icon = step.icon;
                const isLeft = step.side === "left";
                return (
                  <div key={step.id} className="relative flex items-center gap-4">
                    <div className={`flex-1 ${isLeft ? "" : "invisible"}`}>
                      {isLeft && (
                        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: role.accent + "1A" }}>
                                <Icon className="h-3.5 w-3.5" style={{ color: role.accent }} />
                              </div>
                              <span className="text-sm font-bold text-slate-800">{step.title}</span>
                            </div>
                            <BadgePill variant={step.badgeVariant} label={step.badge} />
                          </div>
                          <p className="pl-9 text-xs text-slate-500">{step.description}</p>
                        </div>
                      )}
                    </div>
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md" style={{ backgroundColor: role.accent }}>
                      {step.id}
                    </div>
                    <div className={`flex-1 ${!isLeft ? "" : "invisible"}`}>
                      {!isLeft && (
                        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: role.accent + "1A" }}>
                                <Icon className="h-3.5 w-3.5" style={{ color: role.accent }} />
                              </div>
                              <span className="text-sm font-bold text-slate-800">{step.title}</span>
                            </div>
                            <BadgePill variant={step.badgeVariant} label={step.badge} />
                          </div>
                          <p className="pl-9 text-xs text-slate-500">{step.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="relative flex items-center gap-4">
                <div className="invisible flex-1" />
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md" style={{ backgroundColor: role.accent }}>
                  {finalStep}
                </div>
                <div className="invisible flex-1" />
              </div>
            </div>
          </div>

          {/* Completion Card */}
          <div className="mt-6 rounded-xl border border-white bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h4 className="font-extrabold" style={{ color: role.accent }}>
                {completion.title}
              </h4>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Completed</span>
            </div>
            <p className="mb-4 text-sm text-slate-500">{completion.message}</p>
            <div className="grid grid-cols-3 gap-3">
              {completion.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex flex-col items-center gap-1 text-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: role.accent + "1A" }}>
                      <Icon className="h-4 w-4" style={{ color: role.accent }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                    <span className="text-[11px] text-slate-400">{item.description}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg py-2 text-center text-sm font-medium text-white" style={{ backgroundColor: role.accent }}>
              {activeRole === "buyer" && "Thank you for using CampusBazaar! Happy trading!"}
              {activeRole === "seller" && "Great job! Thank you for being a part of the CampusBazaar community!"}
              {activeRole === "renter" && "Thank you for using CampusBazaar! Happy renting!"}
            </div>
          </div>
          </div>
          )}
          </div>
        </div>

        {/* Feature Discovery Section */}
        <FeatureDiscovery />

        {/* Did You Know Section */}
        <DidYouKnow />

        {/* Bottom tip */}
        <p className="mt-8 text-center text-xs text-slate-400">
          You can always view your requests, chats, and notifications from your dashboard.
        </p>
      </div>
    </div>
  );
}