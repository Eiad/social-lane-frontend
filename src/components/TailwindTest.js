const TailwindTest = () => {
  return (
    <div className="mt-8 mb-8 text-center">
      <div className="bg-green-500 text-white p-4 rounded-lg max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-2">Tailwind CSS Test</h2>
        <p className="text-white">This component uses Tailwind CSS classes.</p>
        <div className="mt-4 flex justify-center space-x-2">
          <div className="bg-blue-500 p-2 rounded">Blue Button</div>
          <div className="bg-red-500 p-2 rounded">Red Button</div>
          <div className="bg-yellow-500 p-2 rounded">Yellow Button</div>
        </div>
      </div>
    </div>
  );
};

export default TailwindTest; 