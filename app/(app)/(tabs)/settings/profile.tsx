import React from 'react';
import ProfileForm from '@/src/components/profile/ProfileForm';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  const handleSave = () => {
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ProfileForm onSave={handleSave} onCancel={handleCancel} />
  );
}