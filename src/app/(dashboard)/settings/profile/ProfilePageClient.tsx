'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { User, Camera, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/lib/actions/profile';
import { getUserPreferences, updatePersonalListVisibility } from '@/lib/actions/user-preferences';

interface ProfilePageClientProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export function ProfilePageClient({ user }: ProfilePageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(user.name ?? '');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(user.avatarUrl);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const result = await updateProfile(formData);

      if (result.success) {
        toast.success('Profile updated successfully');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to update profile');
      }
    } catch (error) {
      toast.error('An error occurred while updating your profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  const hasChanges = name !== (user.name ?? '') || avatarFile !== null;

  // Personal list preferences
  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      const result = await getUserPreferences();
      return result.success ? result.preferences : null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const [isTogglingPersonalList, setIsTogglingPersonalList] = React.useState(false);

  const handleTogglePersonalList = async (checked: boolean) => {
    setIsTogglingPersonalList(true);
    try {
      const result = await updatePersonalListVisibility(!checked);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
        toast.success(checked ? 'Personal List shown' : 'Personal List hidden');
      } else {
        toast.error(result.error ?? 'Failed to update preference');
      }
    } catch {
      toast.error('Failed to update preference');
    } finally {
      setIsTogglingPersonalList(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and how others see you.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your photo and personal details here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview ?? undefined} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Profile photo</p>
                <p className="text-xs text-muted-foreground">
                  Click the camera icon to upload a new photo.
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
              <p className="text-xs text-muted-foreground">
                This is the name that will be displayed across the application.
              </p>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Your email is managed through your authentication provider.
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button type="submit" disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Personal List</CardTitle>
          <CardDescription>
            Manage visibility of your personal task list in My Work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Personal List</Label>
              <p className="text-xs text-muted-foreground">
                Display the Personal List tab in My Work for managing private tasks.
              </p>
            </div>
            <Switch
              checked={!userPrefs?.hidePersonalList}
              onCheckedChange={handleTogglePersonalList}
              disabled={isTogglingPersonalList || !userPrefs}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
