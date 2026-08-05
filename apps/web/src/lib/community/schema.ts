import type {
  CommunityExternalLink,
  CommunityMetadata,
} from "./types";

export const COMMUNITY_SCHEMA_VERSION = 1 as const;
export const COMMUNITY_LIMITS = {
  nameBytes: 64,
  symbolBytes: 12,
  uriBytes: 256,
  descriptionBytes: 2_000,
  linkLabelBytes: 32,
  externalLinks: 10,
} as const;

export type CommunityMetadataDraft = {
  name: string;
  symbol: string;
  description: string;
  collectionUri: string;
  metadataUri: string;
  logo: string;
  externalLinkLabel: string;
  externalLinkUrl: string;
};

export type CommunityMetadataDraftErrors = Partial<
  Record<keyof CommunityMetadataDraft, string>
>;

const textEncoder = new TextEncoder();

export function utf8Length(value: string): number {
  return textEncoder.encode(value).length;
}

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export function isResourceUri(value: string): boolean {
  if (utf8Length(value) > COMMUNITY_LIMITS.uriBytes) return false;
  if (value.startsWith("ipfs://")) return value.length > "ipfs://".length;
  if (!value.startsWith("https://")) return false;

  try {
    return Boolean(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function isHttpsUrl(value: string): boolean {
  if (utf8Length(value) > COMMUNITY_LIMITS.uriBytes) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function resolveCommunityResourceUrl(uri: string): string {
  if (uri.startsWith("https://")) return uri;
  if (uri.startsWith("ipfs://") && uri.length > "ipfs://".length) {
    const gateway =
      process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ?? "https://ipfs.io/ipfs/";
    return `${gateway.replace(/\/?$/, "/")}${uri.slice("ipfs://".length)}`;
  }
  throw new Error("The resource URI is not a supported public URI.");
}

export function validateCommunityMetadataDraft(
  draft: CommunityMetadataDraft,
): CommunityMetadataDraftErrors {
  const errors: CommunityMetadataDraftErrors = {};
  const name = draft.name.trim();
  const description = draft.description.trim();

  if (!name) {
    errors.name = "Enter a community name.";
  } else if (
    utf8Length(draft.name) > COMMUNITY_LIMITS.nameBytes ||
    hasControlCharacter(draft.name)
  ) {
    errors.name = "Use at most 64 UTF-8 bytes and no control characters.";
  }

  if (!draft.symbol.trim()) {
    errors.symbol = "Enter a collection symbol.";
  } else if (
    utf8Length(draft.symbol) > COMMUNITY_LIMITS.symbolBytes ||
    !/^[A-Z0-9]+$/.test(draft.symbol)
  ) {
    errors.symbol = "Use 1–12 uppercase letters or numbers.";
  }

  if (!description) {
    errors.description = "Enter a public community description.";
  } else if (utf8Length(draft.description) > COMMUNITY_LIMITS.descriptionBytes) {
    errors.description = "Use at most 2,000 UTF-8 bytes.";
  }

  if (!draft.collectionUri.trim()) {
    errors.collectionUri = "Enter the NFT collection URI.";
  } else if (!isResourceUri(draft.collectionUri)) {
    errors.collectionUri =
      "Use a valid ipfs:// or https:// URI of at most 256 bytes.";
  }

  if (!draft.metadataUri.trim()) {
    errors.metadataUri = "Enter the community metadata URI.";
  } else if (!isResourceUri(draft.metadataUri)) {
    errors.metadataUri =
      "Use a valid ipfs:// or https:// URI of at most 256 bytes.";
  }

  if (draft.logo && !isResourceUri(draft.logo)) {
    errors.logo = "Use a valid ipfs:// or https:// URI of at most 256 bytes.";
  }

  const hasLinkLabel = Boolean(draft.externalLinkLabel.trim());
  const hasLinkUrl = Boolean(draft.externalLinkUrl.trim());
  if (hasLinkLabel || hasLinkUrl) {
    if (!hasLinkLabel) {
      errors.externalLinkLabel = "Enter a label for this link.";
    } else if (
      utf8Length(draft.externalLinkLabel) >
        COMMUNITY_LIMITS.linkLabelBytes ||
      hasControlCharacter(draft.externalLinkLabel)
    ) {
      errors.externalLinkLabel =
        "Use at most 32 UTF-8 bytes and no control characters.";
    }

    if (!hasLinkUrl) {
      errors.externalLinkUrl = "Enter the HTTPS link URL.";
    } else if (!isHttpsUrl(draft.externalLinkUrl)) {
      errors.externalLinkUrl =
        "Use a valid https:// URL of at most 256 bytes.";
    }
  }

  return errors;
}

function parseExternalLinks(value: unknown): CommunityExternalLink[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > COMMUNITY_LIMITS.externalLinks) {
    return null;
  }

  const links: CommunityExternalLink[] = [];
  for (const link of value) {
    if (
      !isPlainObject(link) ||
      !hasOnlyKeys(link, ["label", "url"]) ||
      typeof link.label !== "string" ||
      !link.label ||
      utf8Length(link.label) > COMMUNITY_LIMITS.linkLabelBytes ||
      hasControlCharacter(link.label) ||
      typeof link.url !== "string" ||
      !isHttpsUrl(link.url)
    ) {
      return null;
    }
    links.push({ label: link.label, url: link.url });
  }
  return links;
}

export function parseCommunityMetadata(
  input: unknown,
  expectedContracts?: { nftContract: string; governorContract: string },
): CommunityMetadata | null {
  if (
    !isPlainObject(input) ||
    !hasOnlyKeys(input, [
      "schemaVersion",
      "name",
      "description",
      "logo",
      "externalLinks",
      "nftContract",
      "governorContract",
    ]) ||
    input.schemaVersion !== COMMUNITY_SCHEMA_VERSION ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    utf8Length(input.name) > COMMUNITY_LIMITS.nameBytes ||
    hasControlCharacter(input.name) ||
    typeof input.description !== "string" ||
    !input.description.trim() ||
    utf8Length(input.description) > COMMUNITY_LIMITS.descriptionBytes
  ) {
    return null;
  }

  if (
    input.logo !== undefined &&
    (typeof input.logo !== "string" || !isResourceUri(input.logo))
  ) {
    return null;
  }

  if (
    input.nftContract !== undefined &&
    (typeof input.nftContract !== "string" ||
      input.nftContract !== expectedContracts?.nftContract)
  ) {
    return null;
  }
  if (
    input.governorContract !== undefined &&
    (typeof input.governorContract !== "string" ||
      input.governorContract !== expectedContracts?.governorContract)
  ) {
    return null;
  }

  const externalLinks = parseExternalLinks(input.externalLinks);
  if (externalLinks === null) return null;

  return {
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    name: input.name,
    description: input.description,
    ...(typeof input.logo === "string" ? { logo: input.logo } : {}),
    externalLinks,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
