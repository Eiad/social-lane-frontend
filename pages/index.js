import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../src/context/AuthContext';
import { 
  LinkedInIcon, 
  TwitterIcon, 
  FacebookIcon, 
  InstagramIcon, 
  YouTubeIcon, 
  TikTokSimpleIcon
} from '../src/components/icons/SocialIcons';

export default function Home() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  
  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      router.push('/media-posting');
    }
  }, [user, router]);

  // Features data
  const features = [
    {
      title: "Post Once, Share Everywhere",
      description: "Schedule and publish content to multiple social networks from a single dashboard.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      )
    },
    {
      title: "Intelligent Scheduling",
      description: "AI-powered scheduling suggests the best times to post for maximum engagement.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: "Comprehensive Analytics",
      description: "Track performance metrics across all platforms in one centralized dashboard.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      title: "Content Library",
      description: "Store and organize all your media assets in one place for easy access.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  // Platforms data
  const platforms = [
    { name: "TikTok", icon: <TikTokSimpleIcon className="w-8 h-8" />, href: "/tiktok", available: true },
    { name: "Twitter", icon: <TwitterIcon className="w-8 h-8" />, href: "/twitter", available: true },
    { name: "Instagram", icon: <InstagramIcon className="w-8 h-8" />, href: "#", available: false },
    { name: "Facebook", icon: <FacebookIcon className="w-8 h-8" />, href: "#", available: false },
    { name: "LinkedIn", icon: <LinkedInIcon className="w-8 h-8" />, href: "#", available: false },
    { name: "YouTube", icon: <YouTubeIcon className="w-8 h-8" />, href: "#", available: false }
  ];

  // Pricing plans
  const pricingPlans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      features: [
        "3 social accounts",
        "30 scheduled posts per month",
        "Basic analytics",
        "Single user"
      ],
      cta: "Start for free",
      popular: false
    },
    {
      name: "Pro",
      price: "$10",
      period: "/month",
      features: [
        "10 social accounts",
        "Unlimited scheduled posts",
        "Advanced analytics",
        "AI content suggestions",
        "Priority support"
      ],
      cta: "Start Pro Trial",
      popular: true
    },
    {
      name: "Business",
      price: "$25",
      period: "/month",
      features: [
        "Unlimited social accounts",
        "Unlimited scheduled posts",
        "Premium analytics",
        "AI content creation",
        "Team collaboration",
        "Dedicated account manager"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  return (
    <>
      <Head>
        <title>Social Lane - Social Media Management Platform</title>
        <meta name="description" content="Manage all your social media accounts in one place. Schedule, post, and analyze your content across multiple platforms." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-indigo-600 to-purple-700 overflow-hidden">
            {/* Navigation */}
        <header className="relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <span className="text-2xl font-bold text-white">Social Lane</span>
                </div>
              <div className="hidden md:flex space-x-10">
                <a href="#features" className="text-base font-medium text-white hover:text-indigo-100 transition">Features</a>
                <a href="#platforms" className="text-base font-medium text-white hover:text-indigo-100 transition">Platforms</a>
                <a href="#pricing" className="text-base font-medium text-white hover:text-indigo-100 transition">Pricing</a>
                </div>
              <div className="flex items-center space-x-4">
                <Link href="/my-account" className="text-base font-medium text-white hover:text-indigo-100 transition">Sign In</Link>
                <Link href="/my-account" className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 transition">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative pt-16 pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              <div className="sm:text-center md:mx-auto lg:col-span-6 lg:text-left lg:flex lg:items-center">
                <div>
                  <h1 className="mt-4 text-4xl tracking-tight font-extrabold text-white sm:mt-5 sm:text-5xl lg:mt-6 xl:text-6xl">
                    <span className="block">Schedule and post</span>
                    <span className="block text-indigo-200">to all social platforms</span>
                  </h1>
                  <p className="mt-3 text-base text-indigo-100 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                    Streamline your social media workflow. Plan, schedule, and automatically post your content across all platforms with one powerful tool.
                  </p>
                  <div className="mt-8 sm:mx-auto sm:max-w-lg sm:text-center lg:mx-0 lg:text-left">
                    <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                      <div className="col-span-1">
                        <TikTokSimpleIcon className="h-8 text-white" />
                      </div>
                      <div className="col-span-1">
                        <TwitterIcon className="h-8 text-white" />
                      </div>
                      <div className="col-span-1">
                        <InstagramIcon className="h-8 text-white" />
                      </div>
                      <div className="col-span-1">
                        <FacebookIcon className="h-8 text-white" />
                      </div>
                      <div className="col-span-1">
                        <LinkedInIcon className="h-8 text-white" />
                      </div>
                      <div className="col-span-1">
                        <YouTubeIcon className="h-8 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-10 sm:flex sm:justify-center lg:justify-start">
                    <div className="rounded-md shadow">
                      <Link href="/my-account" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 md:py-4 md:text-lg md:px-10 transition">
                        Get started
                      </Link>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:ml-3">
                      <a href="#features" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-500 bg-opacity-60 hover:bg-opacity-70 md:py-4 md:text-lg md:px-10 transition">
                        Learn more
                      </a>
                </div>
                  </div>
                </div>
              </div>
              <div className="mt-16 sm:mt-24 lg:mt-0 lg:col-span-6">
                <div className="bg-white sm:max-w-md sm:w-full sm:mx-auto sm:rounded-lg sm:overflow-hidden">
                  <div className="px-4 py-8 sm:px-10">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Sign up in seconds</span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <form action="#" method="POST" className="space-y-6">
                        <div>
                          <label htmlFor="name" className="sr-only">Full name</label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            autoComplete="name"
                            placeholder="Full name"
                            className="block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                          />
                </div>
                
                        <div>
                          <label htmlFor="email" className="sr-only">Email</label>
                          <input
                            type="text"
                            name="email"
                            id="email"
                            autoComplete="email"
                            placeholder="Email"
                            className="block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                          />
                </div>
                
                        <div>
                          <label htmlFor="password" className="sr-only">Password</label>
                          <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Password"
                            autoComplete="current-password"
                            className="block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                          />
                </div>
                
                        <div>
                          <button
                            type="submit"
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Create your free account
                          </button>
                        </div>
                      </form>
                      
                      <div className="mt-6">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>
                        
                        <div className="mt-6">
                          <button
                            type="button"
                            onClick={() => signInWithGoogle()}
                            className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                              </g>
                            </svg>
                            Sign up with Google
                          </button>
                        </div>
                  </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
                </div>
                  </div>
                  
      {/* Features Section */}
      <div className="py-16 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <p className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Features</p>
            <h2 className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              A better way to manage your social presence
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Streamline your social media workflow with powerful tools designed for content creators and marketers.
            </p>
                  </div>
                  
          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <div key={index} className="relative bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition">
                  <div className="rounded-md p-3 inline-flex items-center justify-center bg-indigo-50">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-base text-gray-500">{feature.description}</p>
                </div>
              ))}
                  </div>
                </div>
              </div>
              </div>

            {/* Platforms Section */}
      <div className="py-16 bg-gray-50" id="platforms">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <p className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Platforms</p>
            <h2 className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Connect all your social accounts
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Manage all your social media presence from a single dashboard.
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
              {platforms.map((platform, index) => (
                <Link 
                  key={index} 
                  href={platform.available ? platform.href : "#"}
                  className={`relative flex flex-col items-center justify-center p-6 rounded-lg bg-white ${platform.available 
                    ? 'border border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer' 
                    : 'border border-gray-200 opacity-60 cursor-not-allowed'
                  } transition`}
                >
                  <div className="text-gray-900">{platform.icon}</div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{platform.name}</h3>
                  {!platform.available && (
                    <span className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      Coming Soon
                    </span>
                  )}
                </Link>
              ))}
                </div>
                </div>
                </div>
              </div>

            {/* Pricing Section */}
      <div className="py-16 bg-white" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <p className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Pricing</p>
            <h2 className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              No contracts. No hidden fees. Start for free and upgrade when you need more.
            </p>
                </div>
                
          <div className="mt-16 space-y-12 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
            {pricingPlans.map((plan, index) => (
              <div key={index} className={`relative p-8 bg-white ${plan.popular 
                ? 'ring-2 ring-indigo-600 rounded-lg shadow-xl' 
                : 'border border-gray-200 rounded-lg shadow-sm'
              } flex flex-col`}>
                {plan.popular && (
                  <span className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-4 flex items-baseline text-gray-900">
                    <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                    <span className="ml-1 text-xl font-semibold">{plan.period}</span>
                  </p>
                  <ul className="mt-6 space-y-4">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex">
                        <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="ml-3 text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    className={`w-full ${plan.popular 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    } border border-transparent rounded-md py-3 px-5 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition`}
                  >
                    {plan.cta}
                  </button>
                </div>
                  </div>
                ))}
              </div>
                </div>
                  </div>
                  
      {/* CTA Section */}
      <div className="bg-indigo-600">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            <span className="block">Ready to get started?</span>
            <span className="block text-indigo-200">Start your free trial today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <Link
                href="/my-account"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 transition"
              >
                Get started
              </Link>
                  </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link
                href="#features"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-500 hover:bg-indigo-600 transition"
              >
                Learn more
              </Link>
                  </div>
                  </div>
                </div>
              </div>
              
      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
          <div className="mt-8 flex justify-center space-x-6">
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">Twitter</span>
              <TwitterIcon className="h-6 w-6" />
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">Facebook</span>
              <FacebookIcon className="h-6 w-6" />
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">Instagram</span>
              <InstagramIcon className="h-6 w-6" />
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">LinkedIn</span>
              <LinkedInIcon className="h-6 w-6" />
            </a>
          </div>
          <p className="mt-8 text-center text-base text-gray-400">
            &copy; {new Date().getFullYear()} Social Lane. All rights reserved.
          </p>
      </div>
      </footer>
    </>
  );
}