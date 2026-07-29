import { CreateCommunityWizard } from "@/components/community/CreateCommunityWizard";

export default function CreateCommunityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Create a community</h1>
      <p className="mt-2 text-slate-400">
        Configure metadata and governance, then deploy the NFT and Governor pair
        through the CommunityFactory.
      </p>
      <div className="mt-6">
        <CreateCommunityWizard />
      </div>
    </div>
  );
}
