const fs = require('fs');

const path = '/data/.openclaw/workspace/lima-app/src/pages/MonProfil.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'import { api, type ApiError, fetchMyProfile, API_BASE_URL } from "@/lib/api";',
  'import { api, type ApiError, fetchMyProfile, API_BASE_URL, uploadMemberPhoto } from "@/lib/api";\nimport { Camera } from "lucide-react";'
);

const oldAvatarHTML = `<Avatar className="h-24 w-24 border border-primary/20 shadow-lg">
                <AvatarImage
                  src={getPhotoUrl(profile.photo_url)}
                  alt={getFullName(profile)}
                />
                <AvatarFallback className="bg-gradient-to-br from-cabaret-purple/80 to-cabaret-gold/80 text-2xl font-bold text-background">
                  {getInitials(profile.first_name, profile.last_name)}
                </AvatarFallback>
              </Avatar>`;

const newAvatarHTML = `<div className="relative group">
                <Avatar className="h-24 w-24 border border-primary/20 shadow-lg">
                  <AvatarImage
                    src={getPhotoUrl(profile.photo_url)}
                    alt={getFullName(profile)}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-cabaret-purple/80 to-cabaret-gold/80 text-2xl font-bold text-background">
                    {getInitials(profile.first_name, profile.last_name)}
                  </AvatarFallback>
                </Avatar>
                
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const loadingToast = toast.loading("Envoi de la photo...");
                        await uploadMemberPhoto(profile.id, file);
                        queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                        toast.success("Photo mise à jour !", { id: loadingToast });
                      } catch (err: any) {
                        toast.error(err.detail ?? "Erreur lors de l'upload");
                      }
                    }}
                  />
                  <Camera className="w-8 h-8" />
                </label>
              </div>`;

content = content.replace(oldAvatarHTML, newAvatarHTML);
fs.writeFileSync(path, content);
