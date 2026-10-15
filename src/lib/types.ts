export type Role = "player" | "business";
export type RewardType = "discount" | "gift_card";
export type EggStatus = "pending" | "active" | "claimed";
export type ClaimStatus = "active" | "redeemed";
export type CampaignStatus = "draft" | "pending_payment" | "active";

export interface Profile {
  id: string;
  role: Role;
  displayName: string;
  email: string;
  createdAt: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export interface Campaign {
  id: string;
  businessId: string;
  name: string;
  rewardType: RewardType;
  rewardLabel: string;
  rewardDetail: string;
  rewardTitle: string;
  radiusM: number;
  eggCount: number;
  amountCents: number;
  status: CampaignStatus;
  stripeSessionId: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface Egg {
  id: string;
  campaignId: string;
  businessId: string;
  businessName: string;
  lat: number;
  lng: number;
  rewardType: RewardType;
  rewardLabel: string;
  rewardDetail: string;
  rewardTitle: string;
  status: EggStatus;
  expiresAt: string;
  createdAt: string;
}

export interface Claim {
  id: string;
  eggId: string;
  campaignId: string;
  playerId: string;
  businessId: string;
  businessName: string;
  code: string;
  token: string;
  status: ClaimStatus;
  rewardType: RewardType;
  rewardLabel: string;
  rewardDetail: string;
  rewardTitle: string;
  claimedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
}

export interface Redemption {
  id: string;
  claimId: string;
  businessId: string;
  campaignId: string;
  playerId: string;
  redeemedBy: string;
  redeemedAt: string;
}

export interface Database {
  version: 1;
  seededAt: string;
  profiles: Profile[];
  businesses: Business[];
  campaigns: Campaign[];
  eggs: Egg[];
  claims: Claim[];
  redemptions: Redemption[];
}

export interface NearbyEgg {
  id: string;
  lat: number;
  lng: number;
  businessId: string;
  businessName: string;
  distanceM: number;
  expiresAt: string;
}

export interface Session {
  userId: string;
  role: Role;
  name: string;
  email: string;
  businessId: string | null;
  businessName: string | null;
  driver: "local" | "supabase";
}

export interface DashboardStats {
  businessId: string;
  businessName: string;
  headline: string;
  live: number;
  found: number;
  redeemed: number;
  spendCents: number;
  costPerVisitCents: number | null;
  campaignCount: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  eggCount: number;
  amountCents: number;
  paidAt: string | null;
  rewardTitle: string;
}

export interface CampaignResults {
  id: string;
  name: string;
  status: CampaignStatus;
  rewardTitle: string;
  placed: number;
  live: number;
  found: number;
  redeemed: number;
  newCustomers: number;
  bestDay: string | null;
  topReward: string | null;
  daysRunning: number;
  amountCents: number;
}

export interface CreateCampaignInput {
  businessId: string;
  name: string;
  rewardType: RewardType;
  rewardLabel: string;
  rewardDetail: string;
  rewardTitle: string;
  radiusM: number;
  eggCount: number;
}

export interface RedeemResult {
  claim: Claim;
  redemption: Redemption;
  alreadyRedeemed?: boolean;
}

export interface EggStore {
  reset(): Promise<void>;
  getProfile(id: string): Promise<Profile | null>;
  getProfileByEmail(email: string): Promise<Profile | null>;
  getBusiness(id: string): Promise<Business | null>;
  getBusinessForOwner(ownerId: string): Promise<Business | null>;
  listBusinessesNear(lat: number, lng: number, radiusM: number): Promise<Business[]>;
  listNearbyEggs(lat: number, lng: number, radiusM: number): Promise<NearbyEgg[]>;
  claimEgg(input: { eggId: string; playerId: string; lat: number; lng: number }): Promise<Claim>;
  listClaimsForPlayer(playerId: string): Promise<Claim[]>;
  getClaim(id: string): Promise<Claim | null>;
  redeem(input: { tokenOrCode: string; businessId: string; redeemedBy: string }): Promise<RedeemResult>;
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | null>;
  listCampaigns(businessId: string): Promise<CampaignSummary[]>;
  attachCheckoutSession(campaignId: string, stripeSessionId: string): Promise<void>;
  activateCampaign(campaignId: string, stripeSessionId: string | null): Promise<Campaign>;
  dashboard(businessId: string): Promise<DashboardStats>;
  results(businessId: string, campaignId?: string | null): Promise<{
    campaigns: CampaignSummary[];
    selected: CampaignResults;
  }>;
}
