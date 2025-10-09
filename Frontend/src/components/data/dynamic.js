import { HomeIcon, MapIcon, CarIcon, Handshake, Building, Users } from 'lucide-react';

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
      logoUsed: CarIcon,
      route: '/pd',
    },
    {
      featureName: 'map-view',
      displayName: 'Live Map',
      logoUsed: MapIcon,
      route: '/map-view',
    },
  ];
  if (userData?.role === 'contractor') {
    features.push({
      featureName: 'contractor-bidding',
      displayName: 'Contractor Bidding',
      logoUsed: Handshake,
      route: '/contractor-bidding',
    });
    features.push({
      featureName: 'bidding-details',
      displayName: 'Bidding Details',
      logoUsed: Handshake,
      route: '/bidding-details',
    });
  }
  if (userData?.role === 'government') {
    features.push({
      featureName: 'approve-pothole',
      displayName: 'Approve Pothole',
      logoUsed: Building,
      route: '/approve-pothole',
    });
  }
  if (userData?.role === 'government' || userData?.role==='citizen') {
    features.push({
      featureName: 'communities',
      displayName: 'Community',
      logoUsed: Users,
      route: '/communities',
    });
  }

  return features;
};

export { getFeatures };