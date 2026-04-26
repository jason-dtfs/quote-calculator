import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Camera, Settings } from "lucide-react";

export default function SettingsPage() {
  const { data: settings, isLoading, refetch } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();

  const [shopName, setShopName] = useState("");
  const [defaultTaxRate, setDefaultTaxRate] = useState("0");
  const [defaultMargin, setDefaultMargin] = useState(30);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [shopLogoSize, setShopLogoSize] = useState<"small" | "medium" | "large">("medium");
  const [shopLogoPosition, setShopLogoPosition] = useState<"top-left" | "top-center" | "top-right">("top-left");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setShopName(settings.shopName ?? "");
      setDefaultTaxRate(String(settings.defaultTaxRate ?? "0"));
      setDefaultMargin(settings.defaultMargin ?? 30);
      setCurrencySymbol(settings.currencySymbol ?? "$");
      setMarketingOptIn(settings.marketingOptIn ?? true);
      setShopLogoSize((settings.shopLogoSize as "small" | "medium" | "large") ?? "medium");
      setShopLogoPosition((settings.shopLogoPosition as "top-left" | "top-center" | "top-right") ?? "top-left");
      if (settings.shopLogo) setLogoPreview(settings.shopLogo);
    }
  }, [settings]);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => { toast.success("Settings saved"); refetch(); utils.settings.get.invalidate(); },
    onError: () => toast.error("Failed to save settings"),
  });

  const uploadLogoMutation = trpc.settings.uploadLogo.useMutation({
    onSuccess: (data) => { toast.success("Logo uploaded"); setLogoPreview(data.url); refetch(); },
    onError: () => toast.error("Failed to upload logo"),
  });

  function handleSave() {
    updateMutation.mutate({
      shopName,
      defaultTaxRate,
      defaultMargin,
      currencySymbol,
      marketingOptIn,
      shopLogoSize,
      shopLogoPosition,
    });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadLogoMutation.mutate({ base64, mimeType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const marginSteps = [10, 15, 20, 25, 30, 35, 40];

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/60">
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your shop and quote defaults</p>
      </div>

      <div className="space-y-4">
        {/* Shop Info */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Shop Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Shop Name</Label>
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Your shop name"
                className="h-9"
              />
            </div>

            {/* Logo upload */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Shop Logo (for PDF quotes)</Label>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                  onClick={() => fileRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Shop logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Camera className="h-5 w-5" />
                      <span className="text-[10px]">Upload</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadLogoMutation.isPending}
                    className="gap-1.5"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {uploadLogoMutation.isPending ? "Uploading..." : "Choose Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Max 2MB.</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
            </div>

            {/* Logo PDF settings */}
            {logoPreview && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Logo Size on PDF</Label>
                  <Select value={shopLogoSize} onValueChange={(v) => setShopLogoSize(v as "small" | "medium" | "large")}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Logo Position on PDF</Label>
                  <Select value={shopLogoPosition} onValueChange={(v) => setShopLogoPosition(v as "top-left" | "top-center" | "top-right")}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-center">Top Center</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Defaults */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Quote Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Default Margin</Label>
                <span className="text-sm font-semibold text-primary">{defaultMargin}%</span>
              </div>
              <Slider
                value={[marginSteps.indexOf(defaultMargin) !== -1 ? marginSteps.indexOf(defaultMargin) : 4]}
                onValueChange={([idx]) => setDefaultMargin(marginSteps[idx] ?? 30)}
                min={0}
                max={marginSteps.length - 1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between">
                {marginSteps.map((m) => (
                  <span key={m} className={`text-[10px] ${m === defaultMargin ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {m}%
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Default Tax Rate</Label>
                <div className="relative">
                  <Input
                    value={defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(e.target.value)}
                    placeholder="0"
                    className="h-9 pr-7"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Currency Symbol</Label>
                <Input
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  className="h-9"
                  maxLength={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Marketing emails</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive product updates and printing tips from DTF Station
                </p>
              </div>
              <Switch
                checked={marketingOptIn}
                onCheckedChange={setMarketingOptIn}
                className="shrink-0 data-[state=checked]:bg-primary"
              />
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                Account email and password are managed through your Manus account. Sign out and sign back in to update credentials.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end pt-2 pb-6">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-white px-8 shadow-sm"
          >
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
