import { HomeIcon } from 'lucide-react';

const getFeatures = () => {
  const userData = JSON.parse(localStorage.getItem('account'));

  const features = [
    {
      featureName: 'Home',
      displayName: 'Home',
      logoUsed: HomeIcon,
      route: '/dashboard',
    },
    {
      featureName: 'pd',
      displayName: 'Pothole Detection',
      logoUsed: HomeIcon,
      route: '/pd',
    },
    {
      featureName: 'map-view',
      displayName: 'Live Map',
      logoUsed: HomeIcon,
      route: '/map-view',
    },
  ];
  if (userData?.role === 'contractor') {
    features.push({
      featureName: 'contractor-bidding',
      displayName: 'Contractor Bidding',
      logoUsed: HomeIcon,
      route: '/contractor-bidding',
    });
  }
  if (userData?.role === 'government') {
    features.push({
      featureName: 'approve-pothole',
      displayName: 'Approve Pothole',
      logoUsed: HomeIcon,
      route: '/approve-pothole',
    });
  }

  return features;
};

export { getFeatures };