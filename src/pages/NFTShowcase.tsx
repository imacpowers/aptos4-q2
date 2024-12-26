import React, { useRef, useEffect } from 'react';
import { Card, Button, Space, Typography, message } from 'antd';
import { Twitter, Facebook, Linkedin, Link2 } from 'lucide-react';
import * as THREE from 'three';
import { Translatable } from '../components/translation/Translatable';

const { Title, Text } = Typography;

interface NFT {
  id: number;
  owner: string;
  name: string;
  description: string;
  uri: string;
  rarity: number;
  price: number;
  for_sale: boolean;
  auction: boolean;
  highest_bid: number | null;
  highest_bidder: string | null;
}

interface NFTShowcaseProps {
  nft: NFT;
}

const NFTShowcase: React.FC<NFTShowcaseProps> = ({ nft }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shareUrl = `${window.location.origin}/nft/${nft.id}`;

  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 6;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      alpha: true,
      antialias: true 
    });
    renderer.setSize(window.innerWidth * 0.8, window.innerWidth * 0.5);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Create main display group
    const displayGroup = new THREE.Group();
    scene.add(displayGroup);

    // Load NFT texture
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(nft.uri);
    texture.colorSpace = THREE.SRGBColorSpace;

    // Create NFT plane
    const nftGeometry = new THREE.PlaneGeometry(2.5, 2.5);
    const nftMaterial = new THREE.MeshStandardMaterial({ 
      map: texture, 
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.0
    });
    const nftPlane = new THREE.Mesh(nftGeometry, nftMaterial);
    nftPlane.castShadow = true;
    nftPlane.receiveShadow = true;
    displayGroup.add(nftPlane);

    // Gold material for frame
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      metalness: 0.8,
      roughness: 0.2,
      envMapIntensity: 1.0
    });

    // Frame dimensions
    const frameDepth = 0.1;
    const frameWidth = 0.3;
    const outerWidth = 2.5 + frameWidth * 2;
    const outerHeight = 2.5 + frameWidth * 2;

    // Frame creation helper
    const createFramePiece = (width: number, height: number, depth: number) => {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geometry, goldMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    // Create frame pieces
    const topFrame = createFramePiece(outerWidth, frameWidth, frameDepth);
    topFrame.position.set(0, outerHeight/2 - frameWidth/2, -frameDepth/2);

    const bottomFrame = createFramePiece(outerWidth, frameWidth, frameDepth);
    bottomFrame.position.set(0, -outerHeight/2 + frameWidth/2, -frameDepth/2);

    const leftFrame = createFramePiece(frameWidth, outerHeight, frameDepth);
    leftFrame.position.set(-outerWidth/2 + frameWidth/2, 0, -frameDepth/2);

    const rightFrame = createFramePiece(frameWidth, outerHeight, frameDepth);
    rightFrame.position.set(outerWidth/2 - frameWidth/2, 0, -frameDepth/2);

    // Create decorative corners
    const cornerSize = 0.4;
    const createCorner = () => {
      const geometry = new THREE.BoxGeometry(cornerSize, cornerSize, frameDepth);
      const mesh = new THREE.Mesh(geometry, goldMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const corners = [
      { x: -outerWidth/2 + cornerSize/2, y: outerHeight/2 - cornerSize/2 },
      { x: outerWidth/2 - cornerSize/2, y: outerHeight/2 - cornerSize/2 },
      { x: -outerWidth/2 + cornerSize/2, y: -outerHeight/2 + cornerSize/2 },
      { x: outerWidth/2 - cornerSize/2, y: -outerHeight/2 + cornerSize/2 }
    ].map(pos => {
      const corner = createCorner();
      corner.position.set(pos.x, pos.y, -frameDepth/2);
      return corner;
    });

    // Create diamond base
    const baseGeometry = new THREE.CylinderGeometry(2, 3, 1, 8, 1, false);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0xA3D3FF,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1.0
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(0, -2, -0.5);
    base.castShadow = true;
    base.receiveShadow = true;

    // Add base reflector
    const reflectorGeometry = new THREE.CircleGeometry(3, 8);
    const reflectorMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.1
    });
    const reflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(0, -2.5, 0);
    reflector.receiveShadow = true;

    // Add all elements to display group
    displayGroup.add(
      topFrame, 
      bottomFrame, 
      leftFrame, 
      rightFrame, 
      base,
      reflector,
      ...corners
    );

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 1);
    spotLight.position.set(5, 5, 5);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.1;
    spotLight.decay = 2;
    spotLight.distance = 200;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 512;
    spotLight.shadow.mapSize.height = 512;
    spotLight.shadow.camera.near = 0.5;
    spotLight.shadow.camera.far = 500;
    scene.add(spotLight);

    // Add rim lights
    const rimLight1 = new THREE.PointLight(0xffffff, 0.5);
    rimLight1.position.set(-5, 0, 2);
    scene.add(rimLight1);

    const rimLight2 = new THREE.PointLight(0xffffff, 0.5);
    rimLight2.position.set(5, 0, 2);
    scene.add(rimLight2);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      displayGroup.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      const width = window.innerWidth * 0.8;
      const height = window.innerWidth * 0.5;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, [nft.uri]);

  // Social sharing handlers
  const handleTwitterShare = () => {
    const text = `Check out my NFT: ${nft.name}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  
  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  
  const handleLinkedInShare = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success(<Translatable>'Link copied to clipboard!'</Translatable>);
    } catch (error) {
      message.error(<Translatable>'Failed to copy link'</Translatable>);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-8">
      <Card className="w-full max-w-4xl bg-white rounded-lg shadow-lg">
        <div className="flex flex-col items-center space-y-6">
          <Title level={2}>{nft.name}</Title>
          
          {/* 3D Canvas */}
          <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full"
            />
          </div>
          
          {/* NFT Details */}
          <div className="w-full space-y-4">
            <Text className="text-lg">Description: {<Translatable>{nft.description}</Translatable>}</Text>
            {nft.for_sale && (
              <Text className="text-lg">Price: {nft.price} APT</Text>
            )}
          </div>
          
          {/* Share Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mt-6">
            <Button
              icon={<Twitter className="w-5 h-5" />}
              onClick={handleTwitterShare}
              className="flex items-center space-x-2"
            >
              <Translatable>Share on Twitter</Translatable>
            </Button>
            
            <Button
              icon={<Facebook className="w-5 h-5" />}
              onClick={handleFacebookShare}
              className="flex items-center space-x-2"
            >
              <Translatable>Share on Facebook</Translatable>
            </Button>
            
            <Button
              icon={<Linkedin className="w-5 h-5" />}
              onClick={handleLinkedInShare}
              className="flex items-center space-x-2"
            >
              <Translatable>Share on LinkedIn</Translatable>
            </Button>
            
            <Button
              icon={<Link2 className="w-5 h-5" />}
              onClick={handleCopyLink}
              className="flex items-center space-x-2"
            >
              <Translatable>Copy Link</Translatable>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NFTShowcase;
