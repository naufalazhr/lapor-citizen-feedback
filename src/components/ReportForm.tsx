import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, MapPin, Send } from "lucide-react";
import MapSelector from "./MapSelector";

type ReportFormData = {
  reporter_name: string;
  phone: string;
  address: string;
  description: string;
  type: "lapor" | "aspirasi";
};

const ReportForm = () => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReportFormData>();
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const { toast } = useToast();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ReportFormData) => {
    setLoading(true);

    try {
      let photoUrl = null;

      // Upload photo if exists
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      // Insert report
      const { error } = await supabase.from('reports').insert({
        reporter_name: data.reporter_name,
        phone: data.phone,
        address: data.address,
        description: data.description,
        type: data.type,
        photo_url: photoUrl,
        geo_location: location || null,
      });

      if (error) throw error;

      toast({
        title: "Report submitted successfully",
        description: "Thank you for your report. We will review it shortly.",
      });

      reset();
      setPhotoFile(null);
      setPhotoPreview("");
      setLocation(null);
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-1 bg-gradient-to-r from-primary to-primary-light text-primary-foreground rounded-t-lg">
        <CardTitle className="text-2xl">Submit Your Report</CardTitle>
        <CardDescription className="text-primary-foreground/90">
          Help us serve you better by reporting issues or sharing your aspirations
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="reporter_name">Full Name *</Label>
            <Input
              id="reporter_name"
              {...register("reporter_name", { required: true })}
              placeholder="Enter your full name"
              disabled={loading}
            />
            {errors.reporter_name && (
              <p className="text-sm text-destructive">Name is required</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                {...register("phone", { required: true })}
                placeholder="08123456789"
                disabled={loading}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">Phone is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Report Type *</Label>
              <RadioGroup defaultValue="lapor" onValueChange={(value) => register("type").onChange({ target: { value } })}>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lapor" id="lapor" />
                    <Label htmlFor="lapor" className="font-normal cursor-pointer">Lapor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="aspirasi" id="aspirasi" />
                    <Label htmlFor="aspirasi" className="font-normal cursor-pointer">Aspirasi</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              {...register("address", { required: true })}
              placeholder="Enter your address"
              disabled={loading}
            />
            {errors.address && (
              <p className="text-sm text-destructive">Address is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              {...register("description", { required: true })}
              placeholder="Please describe your report in detail"
              rows={4}
              disabled={loading}
            />
            {errors.description && (
              <p className="text-sm text-destructive">Description is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">Supporting Photo</Label>
            <div className="flex items-center gap-4">
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={loading}
                className="cursor-pointer"
              />
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            {photoPreview && (
              <img src={photoPreview} alt="Preview" className="mt-2 h-32 w-32 object-cover rounded-lg border" />
            )}
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMap(!showMap)}
              className="w-full"
            >
              <MapPin className="mr-2 h-4 w-4" />
              {location ? "Change Location" : "Select Location on Map"}
            </Button>
            {location && (
              <p className="text-sm text-muted-foreground">
                Selected: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            )}
          </div>

          {showMap && (
            <MapSelector
              onLocationSelect={(lat, lng) => {
                setLocation({ lat, lng });
                setShowMap(false);
              }}
            />
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            <Send className="mr-2 h-4 w-4" />
            {loading ? "Submitting..." : "Submit Report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReportForm;
